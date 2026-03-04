"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Save, Loader2, FileText, ChevronDown, ChevronRight, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
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
 * Remove the Footnotes section from pasted text so it isn't parsed as verses.
 * Strips from a line that is exactly "Footnotes" (or "Footnote") to the end of the block.
 */
function stripFootnotesSection(block: string): string {
  const lines = block.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (/^Footnotes?$/i.test(lines[i].trim())) {
      return lines.slice(0, i).join("\n").trim();
    }
  }
  return block;
}

/** Remove footnote markers like [a], [b], [c] from verse text. */
function stripFootnoteMarkers(text: string): string {
  return text.replace(/\s*\[[^\]]*\]\s*/g, " ").replace(/\s+/g, " ").trim();
}

const VERSE_START_REGEX = /^\s*(\d+)[.)\s]+(.*)$/;
/** Matches verse number at line start or after space (e.g. "2 ... 3 Then" on one line). Allows "3 " or "3. " or "3) ". */
const INLINE_VERSE_REGEX = /(?:^|\s)(\d{1,3})(?:[.)]\s+|\s+)([\s\S]*?)(?=\s\d{1,3}(?:[.)]\s+|\s+)|$)/g;

/**
 * Split a line that may contain multiple verses (e.g. "2 Now the earth... 3 Then God said") into [num, text] pairs.
 * Returns [] if the line doesn't start with a verse number.
 */
function splitLineIntoVerses(line: string): { number: number; text: string }[] {
  const results: { number: number; text: string }[] = [];
  const matches = [...line.matchAll(INLINE_VERSE_REGEX)];
  for (const m of matches) {
    const num = parseInt(m[1], 10);
    if (Number.isFinite(num) && num >= 1 && m[2] != null) {
      results.push({ number: num, text: stripFootnoteMarkers(m[2].trim()) });
    }
  }
  return results;
}

/**
 * Parse a block of text into verse-like lines.
 * - Skips leading section titles (e.g. "The Creation") and blank lines until the first verse.
 * - Supports "1 Text", "1. Text", numbered lines, and multiple verses on one line ("2 ... 3 Then").
 * - Strips footnote markers like [a], [b], [c] from verse text.
 */
function parseBlockToVerses(block: string): { number: number; text: string }[] {
  const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const verses: { number: number; text: string }[] = [];
  let seenFirstVerse = false;

  for (const line of lines) {
    const inlineVerses = splitLineIntoVerses(line);
    if (inlineVerses.length > 0) {
      seenFirstVerse = true;
      for (const v of inlineVerses) {
        if (v.text.length > 0) verses.push(v);
      }
      continue;
    }
    const match = line.match(VERSE_START_REGEX);
    if (match) {
      seenFirstVerse = true;
      const num = parseInt(match[1], 10);
      const text = stripFootnoteMarkers(match[2].trim());
      if (Number.isFinite(num) && num >= 1 && text.length > 0) {
        verses.push({ number: num, text });
      }
      continue;
    }
    if (verses.length > 0) {
      verses[verses.length - 1].text += " " + stripFootnoteMarkers(line);
    } else if (!seenFirstVerse) {
      // Skip section title (e.g. "The Creation") and any leading non-verse lines
      continue;
    } else {
      verses.push({ number: 1, text: stripFootnoteMarkers(line) });
    }
  }

  return verses.filter((v) => v.text.length > 0);
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
  const [saving, setSaving] = useState(false);
  const [savingBulk, setSavingBulk] = useState(false);
  const [loadingChapter, setLoadingChapter] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const text = stripFootnotesSection(blockText);
    if (importMode === "multi") {
      const book = books.find((b) => b.slug === bookSlug);
      const verseCounts = book ? getVerseCountsForBook(book.id) : undefined;
      let chapters: ParsedChapter[];
      if (verseCounts && verseCounts.length > 0) {
        const flatVerses = parseBlockToVerses(text);
        if (flatVerses.length === 0) {
          toast.error("No verses detected in the pasted text.");
          return;
        }
        chapters = splitFlatVersesByChapterCounts(flatVerses, verseCounts);
        if (chapters.length === 0) {
          toast.error("Could not split into chapters.");
          return;
        }
      } else {
        chapters = parseBlockToChapters(text);
        if (chapters.length === 0) {
          toast.error(
            "No chapters detected. Add chapter boundaries: lines like 'Chapter 1', 'Chapter 2', or a line with only the chapter number (e.g. '1' then '2')."
          );
          return;
        }
      }
      setParsedChapters(chapters);
      setStep("multi-summary");
      const totalVerses = chapters.reduce((s, c) => s + c.verses.length, 0);
      toast.success(`Parsed ${chapters.length} chapter(s), ${totalVerses} verse(s). Review and Save all.`);
      return;
    }
    const ch = parseInt(chapterNumber, 10);
    if (!Number.isFinite(ch) || ch < 1) {
      toast.error("Enter a chapter number (e.g. 1)");
      return;
    }
    const parsed = parseBlockToVerses(text);
    if (parsed.length === 0) {
      toast.error("No verses detected. Paste text with verse numbers (e.g. '1 In the beginning...')");
      return;
    }
    setVerses(parsed);
    setStep("revise");
    toast.success(`Parsed ${parsed.length} verse(s). Review and edit below, then Save.`);
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
      toast.success(`Saved ${data.count} verse(s) for ${bookSlug} ${ch}.`);
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
      if (failed.length > 0) {
        toast.error(`Saved ${saved} verses; failed: ${failed.join(", ")}`);
      } else {
        toast.success(`Saved ${parsedChapters.length} chapter(s), ${saved} verse(s).`);
      }
      setStep("paste");
      setParsedChapters([]);
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
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
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
              chapters will be overwritten).
            </p>
            <div className="max-h-[320px] overflow-y-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 border-b border-border">
                  <tr>
                    <th className="text-left py-2 px-3 font-mono">Chapter</th>
                    <th className="text-left py-2 px-3">Verses</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedChapters.map((c) => (
                    <tr key={c.chapterNumber} className="border-b border-border/50">
                      <td className="py-1.5 px-3 font-mono">{c.chapterNumber}</td>
                      <td className="py-1.5 px-3">{c.verses.length}</td>
                    </tr>
                  ))}
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
              <Button variant="ghost" onClick={() => { setStep("paste"); setParsedChapters([]); }}>
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
            <div className="max-h-[420px] overflow-y-auto rounded-md border border-border">
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
