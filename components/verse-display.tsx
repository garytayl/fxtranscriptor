"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
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
              <HoverVerseCard verse={verse}>
                <Badge
                  variant="outline"
                  className="font-mono text-xs border-accent/50 text-accent bg-accent/10 hover:bg-accent/20 hover:border-accent/70 transition-all"
                >
                  {verse.full_reference}
                </Badge>
              </HoverVerseCard>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Verse badges with modal dialog for supporting verses
 */
export function VerseBadges({ verses }: VerseDisplayProps) {
  if (!verses || verses.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {verses.map((verse) => (
          <HoverVerseCard key={verse.id} verse={verse}>
            <Badge
              variant="secondary"
              className="font-mono text-xs border-accent/30 hover:border-accent/50 hover:shadow-[0_0_10px_rgba(255,165,0,0.2)] transition-all cursor-pointer"
            >
              {verse.full_reference}
            </Badge>
          </HoverVerseCard>
        ))}
      </div>
    </>
  );
}

type VerseApiResponse = {
  reference: string;
  translation: string;
  chapterReference: string;
  verses: { number: number; text: string }[];
  error?: string;
};

type HoverVerseCardProps = {
  verse: SermonChunkVerse;
  children: React.ReactNode;
};

function HoverVerseCard({ verse, children }: HoverVerseCardProps) {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<VerseApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setResponse(null);
    setError(null);
  }, [verse.full_reference]);

  const load = async () => {
    if (loading || response) {
      return;
    }
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

  return (
    <HoverCard onOpenChange={(open) => open && load()}>
      <HoverCardTrigger asChild>
        <button type="button" className="group">
          {children}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-96">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{verse.full_reference}</p>
              <p className="text-xs text-muted-foreground">
                {response?.translation ? `Translation: ${response.translation}` : "Loading translation..."}
              </p>
            </div>
            <BookOpen className="size-4 text-accent" />
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Loading verses...
            </div>
          )}
          {!loading && error && <p className="text-xs text-destructive">{error}</p>}
          {!loading && response && response.verses?.length > 0 && (
            <ol className="space-y-2 text-sm leading-relaxed">
              {response.verses.map((item) => (
                <li key={item.number} className="text-foreground">
                  <span className="mr-2 align-super text-[10px] font-semibold text-muted-foreground">
                    {item.number}
                  </span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ol>
          )}
          {!loading && response && response.verses?.length === 0 && (
            <p className="text-xs text-muted-foreground">No verses returned for this passage.</p>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
