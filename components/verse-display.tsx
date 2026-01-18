"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookOpen, Loader2 } from "lucide-react";
import type { SermonChunkVerse } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

interface VerseDisplayProps {
  verses: SermonChunkVerse[];
  variant?: "inline" | "badge-only";
  isMainChapter?: boolean;
}

/**
 * Inline expandable verse display for main chapter verses
 */
export function InlineVerseDisplay({ verses, isMainChapter = false }: VerseDisplayProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState<SermonChunkVerse | null>(null);

  if (!verses || verses.length === 0) return null;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors"
      >
        <BookOpen className="size-3" />
        <span>
          {verses.length} {verses.length === 1 ? "Verse" : "Verses"}
          {isMainChapter && " (Main Chapter)"}
        </span>
        <span className="text-[10px]">{expanded ? "−" : "+"}</span>
      </button>
      {expanded && (
        <div className="space-y-2 pl-5 border-l-2 border-accent/20">
          {verses.map((verse) => (
            <div key={verse.id} className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => setSelectedVerse(verse)}
                className="group flex items-center gap-2 text-sm font-mono text-foreground hover:text-accent transition-colors"
              >
                <Badge
                  variant="outline"
                  className="font-mono text-xs border-accent/50 text-accent bg-accent/10 hover:bg-accent/20 hover:border-accent/70 transition-all"
                >
                  {verse.full_reference}
                </Badge>
              </button>
            </div>
          ))}
        </div>
      )}
      <VerseDetailDialog verse={selectedVerse} onClose={() => setSelectedVerse(null)} />
    </div>
  );
}

/**
 * Verse badges with modal dialog for supporting verses
 */
export function VerseBadges({ verses }: VerseDisplayProps) {
  const [selectedVerse, setSelectedVerse] = useState<SermonChunkVerse | null>(null);

  if (!verses || verses.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {verses.map((verse) => (
          <button
            key={verse.id}
            onClick={() => setSelectedVerse(verse)}
            className="group"
          >
            <Badge
              variant="secondary"
              className="font-mono text-xs border-accent/30 hover:border-accent/50 hover:shadow-[0_0_10px_rgba(255,165,0,0.2)] transition-all cursor-pointer"
            >
              {verse.full_reference}
            </Badge>
          </button>
        ))}
      </div>

      <VerseDetailDialog verse={selectedVerse} onClose={() => setSelectedVerse(null)} />
    </>
  );
}

type VerseDetailDialogProps = {
  verse: SermonChunkVerse | null;
  onClose: () => void;
};

type VerseApiResponse = {
  reference: string;
  translation: string;
  chapterReference: string;
  verses: { number: number; text: string }[];
  error?: string;
};

function VerseDetailDialog({ verse, onClose }: VerseDetailDialogProps) {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<VerseApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!verse) {
      setResponse(null);
      setError(null);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ ref: verse.full_reference });
        const res = await fetch(`/api/bible/passage?${params.toString()}`);
        const data = (await res.json()) as VerseApiResponse;
        if (!res.ok) {
          throw new Error(data.error || "Unable to load passage.");
        }
        setResponse(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load passage.");
        setResponse(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [verse]);

  return (
    <Dialog open={!!verse} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-lg">
            {verse?.full_reference}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {response?.translation ? `Translation: ${response.translation}` : "Loading translation..."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
              <Loader2 className="size-4 animate-spin" />
              Loading verses...
            </div>
          )}
          {!loading && error && (
            <p className="text-sm text-destructive font-mono">{error}</p>
          )}
          {!loading && response && response.verses?.length > 0 && (
            <ol className="space-y-3 text-base leading-relaxed">
              {response.verses.map((item) => (
                <li key={item.number} className="rounded-md px-3 py-2 text-foreground">
                  <span className="mr-2 align-super text-xs font-semibold text-muted-foreground">
                    {item.number}
                  </span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ol>
          )}
          {!loading && response && response.verses?.length === 0 && (
            <p className="text-sm text-muted-foreground font-mono">No verses returned for this passage.</p>
          )}
          <Button
            type="button"
            variant="outline"
            className="w-full font-mono text-xs uppercase tracking-widest"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
