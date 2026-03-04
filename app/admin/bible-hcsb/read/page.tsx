"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { VerseText } from "@/lib/bible/verse-text";

type BookProgress = {
  id: string;
  name: string;
  slug: string;
  chapters: number;
  completedChapters: number[];
};

export default function AdminHcsbReadPage() {
  const [books, setBooks] = useState<BookProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookSlug, setBookSlug] = useState("");
  const [chapterNumber, setChapterNumber] = useState<number | null>(null);
  const [verses, setVerses] = useState<{ number: number; text: string }[]>([]);
  const [loadingVerses, setLoadingVerses] = useState(false);

  const loadProgress = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/bible-hcsb/progress", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load progress");
      const data = await res.json();
      const withChapters = (data.books ?? []).filter(
        (b: BookProgress) => Array.isArray(b.completedChapters) && b.completedChapters.length > 0
      );
      setBooks(withChapters);
      if (withChapters.length > 0 && !bookSlug) {
        setBookSlug(withChapters[0].slug);
      }
    } catch {
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, [bookSlug]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const availableChapters = bookSlug
    ? (books.find((b) => b.slug === bookSlug)?.completedChapters ?? []).slice().sort((a, b) => a - b)
    : [];

  useEffect(() => {
    if (!bookSlug || availableChapters.length === 0) {
      setChapterNumber(null);
      setVerses([]);
      return;
    }
    setChapterNumber((prev) => {
      if (prev != null && availableChapters.includes(prev)) return prev;
      return availableChapters[0] ?? null;
    });
  }, [bookSlug, availableChapters.length, availableChapters[0]]);

  useEffect(() => {
    if (!bookSlug || chapterNumber == null) {
      setVerses([]);
      return;
    }
    setLoadingVerses(true);
    fetch(
      `/api/admin/bible-hcsb/verses?book=${encodeURIComponent(bookSlug)}&chapter=${chapterNumber}`,
      { credentials: "include" }
    )
      .then((r) => r.json())
      .then((data) => {
        setVerses(Array.isArray(data.verses) ? data.verses : []);
      })
      .catch(() => setVerses([]))
      .finally(() => setLoadingVerses(false));
  }, [bookSlug, chapterNumber]);

  const bookName = books.find((b) => b.slug === bookSlug)?.name ?? bookSlug;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/bible-hcsb"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="size-4" />
            Back to HCSB Import
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">HCSB Reader (admin)</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View imported HCSB chapters only. Only books and chapters with data in the database are listed.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground font-mono">Loading…</p>
      ) : books.length === 0 ? (
        <div className="rounded-lg border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
          No HCSB chapters imported yet. Use{" "}
          <Link href="/admin/bible-hcsb" className="underline hover:text-foreground">
            HCSB Import
          </Link>{" "}
          to add verses.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                Book
              </span>
              <select
                value={bookSlug}
                onChange={(e) => setBookSlug(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm min-w-[180px]"
              >
                {books.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.name} ({b.completedChapters.length} ch)
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                Chapter
              </span>
              <select
                value={chapterNumber ?? ""}
                onChange={(e) => setChapterNumber(parseInt(e.target.value, 10) || null)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm min-w-[100px]"
              >
                {availableChapters.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-lg border border-border bg-card/60 overflow-hidden">
            <div className="border-b border-border px-4 py-2 bg-muted/40">
              <h2 className="font-semibold">
                {bookName} {chapterNumber}
              </h2>
            </div>
            <div className="p-4 sm:p-6">
              {loadingVerses ? (
                <p className="text-sm text-muted-foreground font-mono flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Loading…
                </p>
              ) : verses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No verses for this chapter.</p>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {verses.map((v) => (
                    <p key={v.number} className="flex gap-2 text-sm leading-relaxed">
                      <span className="font-mono text-muted-foreground shrink-0 select-none">
                        {v.number}
                      </span>
                      <span>
                        <VerseText text={v.text} />
                      </span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
