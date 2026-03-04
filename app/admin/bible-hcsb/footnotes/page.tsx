"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React from "react";
import { ArrowLeft, Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type BookProgress = {
  id: string;
  name: string;
  slug: string;
  chapters: number;
  completedChapters: number[];
};

type FootnoteRow = {
  id: string;
  chapterNumber: number;
  verseNumber: number;
  marker: string;
  text: string;
  kind: string | null;
  targetBookSlug: string | null;
  targetChapter: number | null;
  targetVerse: number | null;
};

function AdminHcsbFootnotesContent() {
  const searchParams = useSearchParams();
  const [books, setBooks] = useState<BookProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookSlug, setBookSlug] = useState("");
  const [chapterFilter, setChapterFilter] = useState<number | "">("");
  const [footnotes, setFootnotes] = useState<FootnoteRow[]>([]);
  const [loadingFootnotes, setLoadingFootnotes] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    text: string;
    kind: string;
    targetBookSlug: string;
    targetChapter: string;
    targetVerse: string;
  }>({ text: "", kind: "", targetBookSlug: "", targetChapter: "", targetVerse: "" });
  const [savingId, setSavingId] = useState<string | null>(null);

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
      const fromUrl = searchParams.get("book");
      if (fromUrl && withChapters.some((b: BookProgress) => b.slug === fromUrl)) {
        setBookSlug(fromUrl);
      } else if (withChapters.length > 0 && !bookSlug) {
        setBookSlug(withChapters[0].slug);
      }
    } catch {
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const availableChapters = bookSlug
    ? (books.find((b) => b.slug === bookSlug)?.completedChapters ?? []).slice().sort((a, b) => a - b)
    : [];

  useEffect(() => {
    if (!bookSlug) {
      setFootnotes([]);
      return;
    }
    setLoadingFootnotes(true);
    const url =
      chapterFilter !== ""
        ? `/api/admin/bible-hcsb/footnotes?book=${encodeURIComponent(bookSlug)}&chapter=${chapterFilter}`
        : `/api/admin/bible-hcsb/footnotes?book=${encodeURIComponent(bookSlug)}`;
    fetch(url, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setFootnotes(Array.isArray(data.footnotes) ? data.footnotes : []);
      })
      .catch(() => setFootnotes([]))
      .finally(() => setLoadingFootnotes(false));
  }, [bookSlug, chapterFilter]);

  const bookName = books.find((b) => b.slug === bookSlug)?.name ?? bookSlug;

  const startEdit = (fn: FootnoteRow) => {
    setEditingId(fn.id);
    setEditForm({
      text: fn.text,
      kind: fn.kind ?? "",
      targetBookSlug: fn.targetBookSlug ?? "",
      targetChapter: fn.targetChapter != null ? String(fn.targetChapter) : "",
      targetVerse: fn.targetVerse != null ? String(fn.targetVerse) : "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSavingId(editingId);
    try {
      const res = await fetch(`/api/admin/bible-hcsb/footnotes/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          text: editForm.text,
          kind: editForm.kind || null,
          targetBookSlug: editForm.targetBookSlug.trim() || null,
          targetChapter: editForm.targetChapter.trim() ? parseInt(editForm.targetChapter, 10) : null,
          targetVerse: editForm.targetVerse.trim() ? parseInt(editForm.targetVerse, 10) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setFootnotes((prev) =>
        prev.map((f) =>
          f.id === editingId
            ? {
                ...f,
                text: editForm.text,
                kind: editForm.kind || null,
                targetBookSlug: editForm.targetBookSlug.trim() || null,
                targetChapter: editForm.targetChapter.trim()
                  ? parseInt(editForm.targetChapter, 10)
                  : null,
                targetVerse: editForm.targetVerse.trim()
                  ? parseInt(editForm.targetVerse, 10)
                  : null,
              }
            : f
        )
      );
      setEditingId(null);
      toast.success("Footnote updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSavingId(null);
    }
  };

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
          <h1 className="text-2xl font-semibold tracking-tight">HCSB Footnotes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View and manage footnotes by book and chapter. Data is auto-populated when you save from Import.
          </p>
        </div>
        <Link
          href="/admin/bible-hcsb"
          className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground border border-border hover:border-foreground/30 px-3 py-2 rounded-md transition-colors"
        >
          Import
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground font-mono flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </p>
      ) : books.length === 0 ? (
        <div className="rounded-lg border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
          No HCSB data yet. Use{" "}
          <Link href="/admin/bible-hcsb" className="underline hover:text-foreground">
            HCSB Import
          </Link>{" "}
          to add verses and footnotes.
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
                value={chapterFilter}
                onChange={(e) =>
                  setChapterFilter(e.target.value === "" ? "" : parseInt(e.target.value, 10))
                }
                className="rounded-md border border-border bg-background px-3 py-2 text-sm min-w-[120px]"
              >
                <option value="">All chapters</option>
                {availableChapters.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-lg border border-border bg-card/60 overflow-hidden">
            <div className="border-b border-border px-4 py-2 bg-muted/40 flex items-center justify-between">
              <h2 className="font-semibold">
                {bookName}
                {chapterFilter !== "" ? ` — Chapter ${chapterFilter}` : " — All footnotes"}
              </h2>
              <span className="text-xs text-muted-foreground font-mono">
                {footnotes.length} footnote{footnotes.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="overflow-x-auto">
              {loadingFootnotes ? (
                <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading…
                </div>
              ) : footnotes.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  No footnotes for this selection. They are created when you paste and save text that includes a
                  Footnotes section.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 border-b border-border">
                    <tr>
                      <th className="text-left py-2 px-3 font-mono w-16">Ch</th>
                      <th className="text-left py-2 px-3 font-mono w-16">Vs</th>
                      <th className="text-left py-2 px-3 font-mono w-12">[ ]</th>
                      <th className="text-left py-2 px-3">Text</th>
                      <th className="text-left py-2 px-3 w-32">Kind</th>
                      <th className="text-left py-2 px-3">Target</th>
                      <th className="w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {footnotes.map((fn) => (
                      <React.Fragment key={fn.id}>
                        <tr
                          className="border-b border-border/50 hover:bg-muted/20 align-top"
                        >
                          <td className="py-1.5 px-3 font-mono text-muted-foreground">{fn.chapterNumber}</td>
                          <td className="py-1.5 px-3 font-mono text-muted-foreground">{fn.verseNumber}</td>
                          <td className="py-1.5 px-3 font-mono">[{fn.marker}]</td>
                          <td className="py-1.5 px-3 max-w-md">{fn.text}</td>
                          <td className="py-1.5 px-3 text-muted-foreground text-xs">
                            {fn.kind ?? "—"}
                          </td>
                          <td className="py-1.5 px-3 text-muted-foreground text-xs font-mono">
                            {fn.targetBookSlug != null &&
                            fn.targetChapter != null &&
                            fn.targetVerse != null
                              ? `${fn.targetBookSlug} ${fn.targetChapter}:${fn.targetVerse}`
                              : "—"}
                          </td>
                          <td className="py-1.5 px-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-muted-foreground hover:text-foreground"
                              onClick={() => startEdit(fn)}
                              disabled={editingId != null}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                          </td>
                        </tr>
                        {editingId === fn.id && (
                          <tr key={`${fn.id}-edit`} className="border-b border-border/50 bg-muted/30">
                            <td colSpan={7} className="p-3">
                              <div className="flex flex-col gap-2 max-w-2xl">
                                <label className="text-xs font-medium">
                                  Text
                                  <textarea
                                    value={editForm.text}
                                    onChange={(e) => setEditForm((f) => ({ ...f, text: e.target.value }))}
                                    rows={2}
                                    className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                                  />
                                </label>
                                <div className="flex flex-wrap gap-4">
                                  <label className="text-xs font-medium">
                                    Kind
                                    <select
                                      value={editForm.kind}
                                      onChange={(e) => setEditForm((f) => ({ ...f, kind: e.target.value }))}
                                      className="ml-1 rounded border border-border bg-background px-2 py-1.5 text-sm"
                                    >
                                      <option value="">—</option>
                                      <option value="cross_reference">cross_reference</option>
                                      <option value="alternate_reading">alternate_reading</option>
                                      <option value="explanatory">explanatory</option>
                                      <option value="textual">textual</option>
                                    </select>
                                  </label>
                                  <label className="text-xs font-medium">
                                    Target book
                                    <Input
                                      value={editForm.targetBookSlug}
                                      onChange={(e) =>
                                        setEditForm((f) => ({ ...f, targetBookSlug: e.target.value }))
                                      }
                                      placeholder="e.g. john"
                                      className="ml-1 h-8 w-32 font-mono text-xs"
                                    />
                                  </label>
                                  <label className="text-xs font-medium">
                                    Ch
                                    <Input
                                      type="number"
                                      min={1}
                                      value={editForm.targetChapter}
                                      onChange={(e) =>
                                        setEditForm((f) => ({ ...f, targetChapter: e.target.value }))
                                      }
                                      className="ml-1 h-8 w-16 font-mono text-xs"
                                    />
                                  </label>
                                  <label className="text-xs font-medium">
                                    Vs
                                    <Input
                                      type="number"
                                      min={1}
                                      value={editForm.targetVerse}
                                      onChange={(e) =>
                                        setEditForm((f) => ({ ...f, targetVerse: e.target.value }))
                                      }
                                      className="ml-1 h-8 w-16 font-mono text-xs"
                                    />
                                  </label>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={saveEdit}
                                    disabled={savingId === fn.id}
                                    className="gap-1"
                                  >
                                    {savingId === fn.id ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                    ) : null}
                                    Save
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={cancelEdit}>
                                    <X className="size-3.5" />
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminHcsbFootnotesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      }
    >
      <AdminHcsbFootnotesContent />
    </Suspense>
  );
}
