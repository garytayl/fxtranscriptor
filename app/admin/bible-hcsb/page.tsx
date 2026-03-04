"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Save, Loader2, FileText, ChevronDown, ChevronRight, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { slugifyBookName } from "@/lib/bible/reference";
import { getVerseCountsForBook } from "@/lib/bible/verse-counts";

type BookProgress = {
  id: string;
  name: string;
  slug: string;
  chapters: number;
  completedChapters: number[];
  totalVerses: number;
};

const TRANSLATION_SLUG = "HCSB";

/**
 * Split pasted block into main text (verses) and the Footnotes section.
 * Uses the *last* line that is "Footnotes" / "Footnote" so we don't truncate when the source
 * has an earlier "Footnotes" heading (e.g. mid-book); only the real footnote block at the end is split off.
 */
function splitBlockIntoMainAndFootnotes(block: string): { mainText: string; footnotesText: string } {
  const lines = block.split(/\r?\n/);
  let lastFootnotesIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^Footnotes?$/i.test(lines[i].trim())) {
      lastFootnotesIndex = i;
    }
  }
  if (lastFootnotesIndex >= 0) {
    const mainText = lines.slice(0, lastFootnotesIndex).join("\n").trim();
    const footnotesText = lines.slice(lastFootnotesIndex + 1).join("\n").trim();
    return { mainText, footnotesText };
  }
  return { mainText: block.trim(), footnotesText: "" };
}

/** Footnote line format: "BookName 1:1 Note text" or "1 Samuel 2:3 Note text". */
const FOOTNOTE_LINE_REGEX = /^(.+?)\s+(\d+):(\d+)\s+(.+)$/;

export type ParsedFootnote = { chapterNumber: number; verseNumber: number; marker: string; text: string };

/**
 * Parse the Footnotes section into entries keyed by book/chapter/verse.
 * Only includes lines for the given bookSlug (book name in line is normalized to slug).
 * Assigns marker a, b, c, ... by order of appearance per (chapter, verse).
 */
function parseFootnoteSection(footnotesText: string, bookSlug: string): ParsedFootnote[] {
  const lines = footnotesText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const raw: { chapterNumber: number; verseNumber: number; text: string }[] = [];
  const targetSlug = bookSlug.toLowerCase().trim();
  for (const line of lines) {
    const m = line.match(FOOTNOTE_LINE_REGEX);
    if (!m) continue;
    const [, bookName, chStr, vsStr, text] = m;
    const slug = slugifyBookName(bookName ?? "");
    if (slug !== targetSlug) continue;
    const chapterNumber = parseInt(chStr ?? "0", 10);
    const verseNumber = parseInt(vsStr ?? "0", 10);
    if (!Number.isFinite(chapterNumber) || !Number.isFinite(verseNumber) || (text ?? "").trim().length === 0)
      continue;
    raw.push({ chapterNumber, verseNumber, text: (text ?? "").trim() });
  }
  const key = (ch: number, vs: number) => `${ch}:${vs}`;
  const orderByVerse = new Map<string, number>();
  return raw.map((r) => {
    const k = key(r.chapterNumber, r.verseNumber);
    const idx = orderByVerse.get(k) ?? 0;
    orderByVerse.set(k, idx + 1);
    const marker = String.fromCharCode(97 + idx);
    return { chapterNumber: r.chapterNumber, verseNumber: r.verseNumber, marker, text: r.text };
  });
}

const VERSE_START_REGEX = /^\s*(\d+)[.)\s]+(.*)$/;
/** Line that is only a verse number (e.g. "2" or "3" on its own line); verse text follows on next line(s). */
const STANDALONE_VERSE_NUMBER_REGEX = /^\s*(\d{1,3})\s*$/;
/** Matches verse number at line start or after space (e.g. "2 ... 3 Then" on one line). Allows "3 " or "3. " or "3) ". */
const INLINE_VERSE_REGEX = /(?:^|\s)(\d{1,3})(?:[.)]\s+|\s+)([\s\S]*?)(?=\s\d{1,3}(?:[.)]\s+|\s+)|$)/g;

/** Captured text that looks like a cross-reference (e.g. "Cor 5:17", "John 3:16") — don't treat as new verse. */
const BOOK_ABBREV_PREFIX = /^(?:1\s?)?(?:Cor|John|Sam|Kgs|Chr|Tim|Pet|Thess|Jas|Jude|Rom|Phil|Col|Heb|Rev|Gen|Exod|Lev|Num|Deut|Josh|Judg|Ruth|Est|Job|Ps|Prov|Eccl|Song|Isa|Jer|Lam|Ezek|Dan|Hos|Joel|Amos|Obad|Jon|Mic|Nah|Hab|Zeph|Hag|Zech|Mal|Matt?|Mark|Luke|Acts)\b/i;

/** Inline verse text must start with capital or quote (avoids "the 2 great lights" → false verse 2). */
const VERSE_TEXT_STARTS_LIKE = /^[A-Z"'\u201C\u2018\u00AB]/;

/**
 * Split a line that may contain multiple verses (e.g. "2 Now the earth... 3 Then God said") into [num, text] pairs.
 * Returns [] if the line doesn't start with a verse number.
 * Skips false positives like "2 Cor 5:17" (cross-reference) and "the 2 great lights" (number in sentence).
 */
function splitLineIntoVerses(line: string): { number: number; text: string }[] {
  const results: { number: number; text: string }[] = [];
  const matches = [...line.matchAll(INLINE_VERSE_REGEX)];
  for (const m of matches) {
    const num = parseInt(m[1], 10);
    const text = m[2] != null ? m[2].trim() : "";
    if (!Number.isFinite(num) || num < 1) continue;
    if (BOOK_ABBREV_PREFIX.test(text)) continue;
    if (text.length > 0 && !VERSE_TEXT_STARTS_LIKE.test(text)) continue;
    results.push({ number: num, text: text.replace(/\s+/g, " ").trim() });
  }
  return results;
}

/**
 * Parse a block of text into verse-like lines.
 * - Skips leading section titles (e.g. "The Creation") and blank lines until the first verse.
 * - Supports "1 Text", "1. Text", numbered lines, and multiple verses on one line ("2 ... 3 Then").
 * - Keeps footnote markers [a], [b], [c] in verse text so they match the parsed footnote section.
 */
function parseBlockToVerses(block: string): { number: number; text: string }[] {
  const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const verses: { number: number; text: string }[] = [];
  let seenFirstVerse = false;
  const norm = (t: string) => t.replace(/\s+/g, " ").trim();

  for (const line of lines) {
    const inlineVerses = splitLineIntoVerses(line);
    if (inlineVerses.length > 0) {
      seenFirstVerse = true;
      for (const v of inlineVerses) verses.push(v);
      continue;
    }
    const match = line.match(VERSE_START_REGEX);
    if (match) {
      const num = parseInt(match[1], 10);
      const rawText = match[2].trim();
      if (BOOK_ABBREV_PREFIX.test(rawText)) {
        if (verses.length > 0) verses[verses.length - 1].text += " " + norm(line);
        else if (!seenFirstVerse) continue;
        else verses.push({ number: 1, text: norm(line) });
        continue;
      }
      seenFirstVerse = true;
      const text = norm(rawText);
      if (Number.isFinite(num) && num >= 1) {
        verses.push({ number: num, text });
      }
      continue;
    }
    const standaloneNum = line.match(STANDALONE_VERSE_NUMBER_REGEX);
    if (standaloneNum && parseInt(standaloneNum[1], 10) >= 1) {
      seenFirstVerse = true;
      verses.push({ number: parseInt(standaloneNum[1], 10), text: "" });
      continue;
    }
    if (verses.length > 0) {
      verses[verses.length - 1].text += " " + norm(line);
    } else if (!seenFirstVerse) {
      // Skip section title (e.g. "The Creation") and any leading non-verse lines
      continue;
    } else {
      verses.push({ number: 1, text: norm(line) });
    }
  }

  // Keep all verses including empty text — otherwise standalone verse numbers (e.g. "9" on its own line)
  // followed by "10 Then..." get dropped and we lose verse count (e.g. Genesis 19 only 8 instead of 38).
  return verses;
}

/** Chapter boundary: "Chapter 1", "CHAPTER 1", or a line that is only a number (e.g. "1" or "2"). */
const CHAPTER_HEADING_REGEX = /^\s*(?:Chapter|CHAPTER)\s+(\d+)\s*$/i;
const STANDALONE_CHAPTER_NUMBER_REGEX = /^\s*(\d+)\s*$/;

export type ParsedChapter = { chapterNumber: number; verses: { number: number; text: string }[] };

/**
 * Split a block of text into multiple chapters by detecting boundaries.
 * Boundaries: lines like "Chapter 1", "CHAPTER 2", or a line containing only a number (e.g. "1").
 * Each segment is then parsed into verses with parseBlockToVerses.
 */
function parseBlockToChapters(block: string): ParsedChapter[] {
  const lines = block.split(/\r?\n/);
  const chapters: ParsedChapter[] = [];
  let currentSegment: string[] = [];
  let currentChapterNum = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const chapterMatch = trimmed.match(CHAPTER_HEADING_REGEX);
    const standaloneNum = trimmed.match(STANDALONE_CHAPTER_NUMBER_REGEX);
    const isChapterBoundary =
      chapterMatch != null ||
      (standaloneNum != null &&
        currentSegment.length > 0 &&
        parseInt(standaloneNum[1], 10) >= 1 &&
        parseInt(standaloneNum[1], 10) <= 150);

    if (isChapterBoundary && currentSegment.length > 0) {
      const segmentText = currentSegment.join("\n");
      const verses = parseBlockToVerses(segmentText);
      if (verses.length > 0) {
        chapters.push({ chapterNumber: currentChapterNum, verses });
      }
      currentSegment = [];
      currentChapterNum = chapterMatch
        ? parseInt(chapterMatch[1], 10)
        : parseInt(standaloneNum![1], 10);
      continue;
    }
    if (chapterMatch) {
      currentChapterNum = parseInt(chapterMatch[1], 10);
      continue;
    }
    if (standaloneNum && currentSegment.length === 0) {
      const num = parseInt(standaloneNum[1], 10);
      if (num >= 1 && num <= 150) currentChapterNum = num;
      continue;
    }

    if (trimmed.length > 0) currentSegment.push(line);
  }

  if (currentSegment.length > 0) {
    const segmentText = currentSegment.join("\n");
    const verses = parseBlockToVerses(segmentText);
    if (verses.length > 0) {
      chapters.push({ chapterNumber: currentChapterNum, verses });
    }
  }

  return chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
}

/**
 * Split a flat list of verses into chapters using known verse counts per chapter (e.g. Genesis 31, 25, 24, ...).
 * Use when the pasted text has no "Chapter N" headers. Handles partial pastes (fewer verses than full book).
 */
function splitFlatVersesByChapterCounts(
  flatVerses: { number: number; text: string }[],
  verseCountsPerChapter: number[]
): ParsedChapter[] {
  const chapters: ParsedChapter[] = [];
  let idx = 0;
  for (let ch = 1; ch <= verseCountsPerChapter.length && idx < flatVerses.length; ch++) {
    const count = verseCountsPerChapter[ch - 1] ?? 0;
    const slice = flatVerses.slice(idx, idx + count);
    if (slice.length === 0) break;
    chapters.push({
      chapterNumber: ch,
      verses: slice.map((v, i) => ({ number: i + 1, text: v.text })),
    });
    idx += slice.length;
  }
  if (idx < flatVerses.length) {
    const totalExpected = verseCountsPerChapter.reduce((a, b) => a + b, 0);
    if (flatVerses.length > totalExpected) {
      chapters.push({
        chapterNumber: chapters.length + 1,
        verses: flatVerses.slice(idx).map((v, i) => ({ number: i + 1, text: v.text })),
      });
    }
  }
  return chapters;
}

type ImportMode = "single" | "multi";

export default function AdminBibleHcsbPage() {
  const [books, setBooks] = useState<BookProgress[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [expandedBook, setExpandedBook] = useState<string | null>(null);

  const [importMode, setImportMode] = useState<ImportMode>("single");
  const [step, setStep] = useState<"paste" | "revise" | "saved" | "multi-summary">("paste");
  const [bookSlug, setBookSlug] = useState("");
  const [chapterNumber, setChapterNumber] = useState("");
  const [blockText, setBlockText] = useState("");
  const [verses, setVerses] = useState<{ number: number; text: string }[]>([]);
  const [parsedChapters, setParsedChapters] = useState<ParsedChapter[]>([]);
  /** When splitting by verse counts, expected count per chapter (index = chapterNumber - 1). Used to warn if paste is incomplete. */
  const [expectedVerseCounts, setExpectedVerseCounts] = useState<number[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingBulk, setSavingBulk] = useState(false);
  const [loadingChapter, setLoadingChapter] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearBookSlug, setClearBookSlug] = useState("");
  const [clearChapter, setClearChapter] = useState<number | "all">("all");
  const [startChapterInput, setStartChapterInput] = useState("");
  const [parsedFootnotes, setParsedFootnotes] = useState<ParsedFootnote[]>([]);
  /** Which chapter (number) has its problem details expanded in multi-summary. */
  const [expandedChapterSummary, setExpandedChapterSummary] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClear = async () => {
    if (!clearBookSlug) {
      toast.error("Select a book to clear.");
      return;
    }
    if (clearChapter !== "all" && (typeof clearChapter !== "number" || clearChapter < 1)) {
      toast.error("Select a chapter or Entire book.");
      return;
    }
    if (!confirm(clearChapter === "all" ? `Remove all HCSB verses for this book? This cannot be undone.` : `Remove HCSB verses for this chapter? This cannot be undone.`)) {
      return;
    }
    setClearing(true);
    try {
      const url =
        clearChapter === "all"
          ? `/api/admin/bible-hcsb/verses?book=${encodeURIComponent(clearBookSlug)}`
          : `/api/admin/bible-hcsb/verses?book=${encodeURIComponent(clearBookSlug)}&chapter=${clearChapter}`;
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Clear failed");
      toast.success(clearChapter === "all" ? `Cleared entire book.` : `Cleared chapter ${clearChapter}.`);
      setClearBookSlug("");
      setClearChapter("all");
      loadProgress();
    } catch (err) {
      toast.error("Clear failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setClearing(false);
    }
  };

  const loadProgress = useCallback(async () => {
    setLoadingProgress(true);
    try {
      const res = await fetch("/api/admin/bible-hcsb/progress", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load progress");
      const data = await res.json();
      setBooks(data.books ?? []);
    } catch (err) {
      toast.error("Error loading progress", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setLoadingProgress(false);
    }
  }, []);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const handleParse = () => {
    if (!bookSlug.trim()) {
      toast.error("Select a book first.");
      return;
    }
    const { mainText, footnotesText } = splitBlockIntoMainAndFootnotes(blockText);
    const footnotes = parseFootnoteSection(footnotesText, bookSlug.trim().toLowerCase());
    setParsedFootnotes(footnotes);

    if (importMode === "multi") {
      const book = books.find((b) => b.slug === bookSlug);
      const verseCounts = book ? getVerseCountsForBook(book.id) : undefined;
      let chapters: ParsedChapter[];
      if (verseCounts && verseCounts.length > 0) {
        const flatVerses = parseBlockToVerses(mainText);
        if (flatVerses.length === 0) {
          toast.error("No verses detected in the pasted text.");
          return;
        }
        chapters = splitFlatVersesByChapterCounts(flatVerses, verseCounts);
        if (chapters.length === 0) {
          toast.error("Could not split into chapters.");
          return;
        }
        setExpectedVerseCounts(verseCounts.slice(0, chapters.length));
      } else {
        chapters = parseBlockToChapters(mainText);
        setExpectedVerseCounts(null);
        if (chapters.length === 0) {
          toast.error(
            "No chapters detected. Add chapter boundaries: lines like 'Chapter 1', 'Chapter 2', or a line with only the chapter number (e.g. '1' then '2')."
          );
          return;
        }
      }
      const startCh = parseInt(startChapterInput.trim(), 10);
      if (Number.isFinite(startCh) && startCh >= 1) {
        chapters = chapters.map((c, i) => ({ ...c, chapterNumber: startCh + i }));
      }
      setParsedChapters(chapters);
      setStep("multi-summary");
      const totalVerses = chapters.reduce((s, c) => s + c.verses.length, 0);
      toast.success(`Parsed ${chapters.length} chapter(s), ${totalVerses} verse(s).${footnotes.length ? ` ${footnotes.length} footnote(s) will be saved.` : ""}`);
      return;
    }
    const ch = parseInt(chapterNumber, 10);
    if (!Number.isFinite(ch) || ch < 1) {
      toast.error("Enter a chapter number (e.g. 1)");
      return;
    }
    const parsed = parseBlockToVerses(mainText);
    if (parsed.length === 0) {
      toast.error("No verses detected. Paste text with verse numbers (e.g. '1 In the beginning...')");
      return;
    }
    setVerses(parsed);
    setStep("revise");
    toast.success(`Parsed ${parsed.length} verse(s).${footnotes.length ? ` ${footnotes.length} footnote(s) will be saved.` : ""} Review and edit below, then Save.`);
  };

  const loadExistingChapter = async () => {
    const ch = parseInt(chapterNumber, 10);
    if (!bookSlug.trim() || !Number.isFinite(ch) || ch < 1) return;
    setLoadingChapter(true);
    try {
      const res = await fetch(
        `/api/admin/bible-hcsb/verses?book=${encodeURIComponent(bookSlug)}&chapter=${ch}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to load chapter");
      const data = await res.json();
      setVerses((data.verses ?? []).map((v: { number: number; text: string }) => ({ number: v.number, text: v.text })));
      setStep("revise");
      if ((data.verses ?? []).length > 0) {
        toast.success(`Loaded ${data.verses.length} verses for revision.`);
      } else {
        toast.info("No existing verses for this chapter. Paste a block and Parse instead.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load chapter");
    } finally {
      setLoadingChapter(false);
    }
  };

  const handleSave = async () => {
    const ch = parseInt(chapterNumber, 10);
    if (!bookSlug.trim() || !Number.isFinite(ch) || ch < 1 || verses.length === 0) {
      toast.error("Book, chapter, and at least one verse are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/bible-hcsb/verses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bookSlug: bookSlug.trim().toLowerCase(), chapterNumber: ch, verses }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      const chapterFootnotes = parsedFootnotes.filter((f) => f.chapterNumber === ch);
      if (chapterFootnotes.length > 0) {
        const fnRes = await fetch("/api/admin/bible-hcsb/footnotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            bookSlug: bookSlug.trim().toLowerCase(),
            footnotes: chapterFootnotes,
          }),
        });
        if (!fnRes.ok) {
          const fnData = await fnRes.json();
          throw new Error(fnData.error || "Footnotes save failed");
        }
      }
      toast.success(`Saved ${data.count} verse(s)${chapterFootnotes.length ? ` and ${chapterFootnotes.length} footnote(s)` : ""} for ${bookSlug} ${ch}.`);
      setStep("saved");
      loadProgress();
    } catch (err) {
      toast.error("Save failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAllChapters = async () => {
    if (!bookSlug.trim() || parsedChapters.length === 0) return;
    setSavingBulk(true);
    let saved = 0;
    let failed: string[] = [];
    try {
      for (const { chapterNumber: ch, verses: vs } of parsedChapters) {
        const res = await fetch("/api/admin/bible-hcsb/verses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            bookSlug: bookSlug.trim().toLowerCase(),
            chapterNumber: ch,
            verses: vs,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          failed.push(`${bookSlug} ${ch}`);
          continue;
        }
        saved += data.count ?? vs.length;
      }
      const chapterSet = new Set(parsedChapters.map((c) => c.chapterNumber));
      const footnotesToSave = parsedFootnotes.filter((f) => chapterSet.has(f.chapterNumber));
      if (footnotesToSave.length > 0) {
        const fnRes = await fetch("/api/admin/bible-hcsb/footnotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            bookSlug: bookSlug.trim().toLowerCase(),
            footnotes: footnotesToSave,
          }),
        });
        if (!fnRes.ok) {
          const fnData = await fnRes.json();
          toast.error(`Verses saved; footnotes failed: ${fnData.error ?? "Unknown"}`);
        }
      }
      if (failed.length > 0) {
        toast.error(`Saved ${saved} verses; failed: ${failed.join(", ")}`);
      } else {
        toast.success(
          `Saved ${parsedChapters.length} chapter(s), ${saved} verse(s).${footnotesToSave.length ? ` ${footnotesToSave.length} footnote(s).` : ""}`
        );
      }
      setStep("paste");
      setParsedChapters([]);
      setExpectedVerseCounts(null);
      setExpandedChapterSummary(null);
      setParsedFootnotes([]);
      loadProgress();
    } catch (err) {
      toast.error("Bulk save failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setSavingBulk(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setBlockText(text);
      toast.success(`Loaded ${file.name}`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const updateVerse = (index: number, field: "number" | "text", value: number | string) => {
    setVerses((prev) => {
      const next = [...prev];
      if (field === "number") next[index] = { ...next[index], number: value as number };
      else next[index] = { ...next[index], text: value as string };
      return next;
    });
  };

  const totalChapters = books.reduce((s, b) => s + b.chapters, 0);
  const completedChapters = books.reduce((s, b) => s + b.completedChapters.length, 0);
  const progressPct = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">HCSB Import</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Add the Holman Christian Standard Bible to your Supabase database. Paste a block of text, organize into verses, revise, then save. Track progress by book and chapter below.
            </p>
          </div>
          <Link
            href="/bible?t=hcsb"
            className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground border border-border hover:border-foreground/30 px-3 py-2 rounded-md transition-colors"
          >
            View HCSB in Bible reader →
          </Link>
        </div>
      </div>

      {/* Progress tracker */}
      <div className="rounded-lg border border-border bg-card/60 p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-2">Progress</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {completedChapters} of {totalChapters} chapters completed ({progressPct}%)
        </p>
        {loadingProgress ? (
          <p className="text-sm text-muted-foreground font-mono">Loading…</p>
        ) : (
          <div className="admin-scroll space-y-2 max-h-[400px] overflow-y-auto">
            {books.map((book) => {
              const completed = new Set(book.completedChapters);
              const isExpanded = expandedBook === book.slug;
              return (
                <div key={book.slug} className="border border-border/50 rounded-md overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedBook(isExpanded ? null : book.slug)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30"
                  >
                    {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    <span className="font-medium">{book.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {book.completedChapters.length}/{book.chapters}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 flex flex-wrap gap-1">
                      {Array.from({ length: book.chapters }, (_, i) => i + 1).map((ch) => (
                        <span
                          key={ch}
                          className={`inline-flex h-7 min-w-[2rem] items-center justify-center rounded px-2 text-xs font-mono ${
                            completed.has(ch)
                              ? "bg-primary/20 text-primary border border-primary/40"
                              : "bg-muted/50 text-muted-foreground border border-border"
                          }`}
                          title={completed.has(ch) ? `${book.name} ${ch} – done` : `${book.name} ${ch} – not yet`}
                        >
                          {ch}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!loadingProgress && books.some((b) => b.completedChapters.length > 0) && (
          <div className="mt-6 pt-4 border-t border-border">
            <h3 className="text-sm font-medium mb-2">Clear data</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Remove HCSB verses for a chapter or entire book. This cannot be undone.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Book</span>
                <select
                  value={clearBookSlug}
                  onChange={(e) => { setClearBookSlug(e.target.value); setClearChapter("all"); }}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm min-w-[140px]"
                >
                  <option value="">Select book</option>
                  {books.filter((b) => b.completedChapters.length > 0).map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Chapter</span>
                <select
                  value={clearChapter === "all" ? "" : clearChapter}
                  onChange={(e) => setClearChapter(e.target.value === "" ? "all" : parseInt(e.target.value, 10))}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm min-w-[120px]"
                >
                  <option value="">Entire book</option>
                  {clearBookSlug &&
                    books
                      .find((b) => b.slug === clearBookSlug)
                      ?.completedChapters.slice()
                      .sort((a, b) => a - b)
                      .map((ch) => (
                        <option key={ch} value={ch}>
                          {ch}
                        </option>
                      ))}
                </select>
              </label>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleClear}
                disabled={clearing || !clearBookSlug}
                className="gap-2 font-mono text-xs uppercase tracking-widest"
              >
                {clearing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                {clearing ? "Clearing…" : "Clear"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Organize / Revise */}
      <div className="rounded-lg border border-border bg-card/60 p-4 sm:p-6 space-y-6">
        <h2 className="text-lg font-semibold">Add or revise</h2>

        {/* Import mode: single chapter vs whole book / multiple chapters */}
        {(step === "paste" || step === "saved") && (
          <div className="flex flex-wrap gap-4">
            <span className="text-sm text-muted-foreground">Import:</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="importMode"
                checked={importMode === "single"}
                onChange={() => setImportMode("single")}
                className="rounded border-border"
              />
              <span className="text-sm">Single chapter</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="importMode"
                checked={importMode === "multi"}
                onChange={() => setImportMode("multi")}
                className="rounded border-border"
              />
              <span className="text-sm">Whole book or multiple chapters</span>
            </label>
          </div>
        )}

        {(step === "paste" || step === "saved") && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                  Book
                </label>
                <select
                  value={bookSlug}
                  onChange={(e) => setBookSlug(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select book</option>
                  {books.map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              {importMode === "multi" && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                    Starting chapter
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={startChapterInput}
                    onChange={(e) => setStartChapterInput(e.target.value)}
                    placeholder="e.g. 21 (if pasting ch 21–34)"
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Leave blank if pasting from chapter 1. Set to 21 if your paste is chapters 21–34, etc.
                  </p>
                </div>
              )}
              {importMode === "single" && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                    Chapter number
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={chapterNumber}
                    onChange={(e) => setChapterNumber(e.target.value)}
                    placeholder="e.g. 1"
                  />
                </div>
              )}
            </div>
            {importMode === "single" && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadExistingChapter}
                  disabled={loadingChapter || !bookSlug || !chapterNumber}
                  className="gap-2 font-mono text-xs uppercase tracking-widest"
                >
                  {loadingChapter ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                  Load existing chapter to revise
                </Button>
              </div>
            )}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                  {importMode === "multi"
                    ? "Paste or upload full book / multiple chapters"
                    : "Paste block of text"}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,text/plain"
                  onChange={handleFileUpload}
                  className="sr-only"
                  aria-hidden
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 font-mono text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-4" />
                  Upload .txt
                </Button>
              </div>
              <textarea
                value={blockText}
                onChange={(e) => setBlockText(e.target.value)}
                rows={importMode === "multi" ? 16 : 12}
                placeholder={
                  importMode === "multi"
                    ? `Paste or upload text with chapter boundaries. A "Footnotes" section at the end is stripped automatically.\n\nExample:\nChapter 1\n1 In the beginning God created...\n2 The earth was formless...\n\nChapter 2\n1 Thus the heavens...\n\nFootnotes\nGenesis 1:1 Or created the universe\n...`
                    : `Paste one chapter. A "Footnotes" section at the end is stripped automatically.\n\nUse verse numbers at the start of each line, e.g.:\n1 In the beginning God created...\n2 The earth was formless...\n\nOr: 1. First verse 2. Second verse`
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono leading-relaxed"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleParse} className="gap-2 font-mono text-xs uppercase tracking-widest">
                Parse & organize
              </Button>
              {step === "saved" && (
                <Button variant="ghost" onClick={() => setStep("paste")}>
                  Add another chapter
                </Button>
              )}
            </div>
          </>
        )}

        {step === "multi-summary" && (
          <>
            <p className="text-sm text-muted-foreground">
              Detected {parsedChapters.length} chapter(s). Save all to the database (existing verses for these
              chapters will be overwritten). Expand a row to see which verses are present, missing, or empty.
            </p>
            <div className="admin-scroll max-h-[380px] overflow-y-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 border-b border-border">
                  <tr>
                    <th className="text-left py-2 px-3 font-mono w-0" />
                    <th className="text-left py-2 px-3 font-mono">Chapter</th>
                    <th className="text-left py-2 px-3">Verses</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedChapters.map((c, i) => {
                    const expected = expectedVerseCounts?.[i];
                    const isShort = expected != null && c.verses.length < expected;
                    const emptyVerses = c.verses.filter((v) => !v.text.trim()).map((v) => v.number);
                    const hasProblems = isShort || emptyVerses.length > 0;
                    const isExpanded = expandedChapterSummary === c.chapterNumber;
                    const missingRange =
                      expected != null && c.verses.length < expected
                        ? c.verses.length + 1 <= expected
                          ? `${c.verses.length + 1}–${expected}`
                          : ""
                        : "";
                    return (
                      <React.Fragment key={c.chapterNumber}>
                        <tr
                          key={c.chapterNumber}
                          className={`border-b border-border/50 ${isShort ? "bg-amber-500/10" : ""} ${hasProblems ? "cursor-pointer hover:bg-muted/50" : ""}`}
                          onClick={() => hasProblems && setExpandedChapterSummary((x) => (x === c.chapterNumber ? null : c.chapterNumber))}
                        >
                          <td className="py-1.5 pl-2 pr-1">
                            {hasProblems ? (
                              <span className="text-muted-foreground" aria-hidden>
                                {isExpanded ? "▼" : "▶"}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-1.5 px-3 font-mono">{c.chapterNumber}</td>
                          <td className="py-1.5 px-3">
                            {c.verses.length}
                            {isShort && (
                              <span className="ml-1.5 text-amber-600 dark:text-amber-400 text-xs">
                                (expected {expected})
                              </span>
                            )}
                            {emptyVerses.length > 0 && (
                              <span className="ml-1.5 text-muted-foreground text-xs">
                                ({emptyVerses.length} empty)
                              </span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && hasProblems && (
                          <tr key={`${c.chapterNumber}-detail`} className="border-b border-border/50 bg-muted/30">
                            <td colSpan={3} className="py-2 px-3 text-xs text-muted-foreground">
                              <div className="flex flex-col gap-1">
                                <span>
                                  <strong className="text-foreground">Present:</strong> verses 1–{c.verses.length}
                                </span>
                                {missingRange && (
                                  <span>
                                    <strong className="text-amber-600 dark:text-amber-400">Missing from paste:</strong> verses {missingRange}
                                    {" — add these verses to your pasted text and parse again."}
                                  </span>
                                )}
                                {emptyVerses.length > 0 && (
                                  <span>
                                    <strong className="text-foreground">Empty (no text):</strong> verses {emptyVerses.slice(0, 20).join(", ")}
                                    {emptyVerses.length > 20 ? ` … +${emptyVerses.length - 20} more` : ""}
                                    {" — parser saw the verse number but no content (e.g. number on its own line)."}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSaveAllChapters}
                disabled={savingBulk}
                className="gap-2 font-mono text-xs uppercase tracking-widest"
              >
                {savingBulk ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {savingBulk ? "Saving…" : "Save all chapters"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setStep("paste");
                  setParsedChapters([]);
                  setExpectedVerseCounts(null);
                  setExpandedChapterSummary(null);
                }}
              >
                Back to paste
              </Button>
            </div>
          </>
        )}

        {step === "revise" && (
          <>
            <p className="text-sm text-muted-foreground">
              Review and edit verses below. Then save to store in the database.
            </p>
            <div className="admin-scroll max-h-[420px] overflow-y-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 border-b border-border">
                  <tr>
                    <th className="text-left py-2 px-3 font-mono w-16">#</th>
                    <th className="text-left py-2 px-3">Text</th>
                  </tr>
                </thead>
                <tbody>
                  {verses.map((v, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-1.5 px-3 align-top">
                        <Input
                          type="number"
                          min={1}
                          value={v.number}
                          onChange={(e) => updateVerse(i, "number", parseInt(e.target.value, 10) || 1)}
                          className="h-8 w-14 font-mono text-xs"
                        />
                      </td>
                      <td className="py-1.5 px-3">
                        <textarea
                          value={v.text}
                          onChange={(e) => updateVerse(i, "text", e.target.value)}
                          rows={2}
                          className="w-full min-w-[200px] rounded border border-border bg-background px-2 py-1.5 text-xs"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="gap-2 font-mono text-xs uppercase tracking-widest">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {saving ? "Saving…" : "Save to database"}
              </Button>
              <Button variant="ghost" onClick={() => setStep("paste")}>
                Back to paste
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
