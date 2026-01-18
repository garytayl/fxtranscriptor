"use client";

import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { getReaderUrlFromReference } from "@/lib/bible/reference";
import { BookOpen, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface VerseReference {
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number | null;
  full_reference: string;
}

interface VerseInlineProps {
  content: string;
  verses: VerseReference[];
  activeVerseIds?: Set<string>;
  onVerseEnter?: (verseId: string) => void;
  onVerseLeave?: (verseId: string) => void;
}

/**
 * Verse badge component with intersection observer for highlighting
 */
function VerseBadgeComponent({
  verse,
  content,
  isActive,
  onEnter,
  onLeave,
}: {
  verse: VerseReference;
  content: string;
  isActive: boolean;
  onEnter?: () => void;
  onLeave?: () => void;
}) {
  const badgeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{
    translation: string;
    verses: { number: number; text: string }[];
    error?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const badge = badgeRef.current;
    if (!badge) return;
    if (typeof window !== "undefined") {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion) {
        return;
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            onEnter?.();
          } else {
            onLeave?.();
          }
        });
      },
      {
        threshold: 0.5,
        rootMargin: "-20% 0px -20% 0px",
      }
    );

    observer.observe(badge);

    return () => {
      observer.disconnect();
    };
  }, [onEnter, onLeave]);

  const loadVerse = async () => {
    if (loading || response) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ ref: verse.full_reference });
      const res = await fetch(`/api/bible/passage?${params.toString()}`);
      const data = (await res.json()) as {
        translation: string;
        verses: { number: number; text: string }[];
        error?: string;
      };
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

  const readerUrl = getReaderUrlFromReference(verse.full_reference);

  return (
    <HoverCard
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          loadVerse();
        }
      }}
    >
      <HoverCardTrigger asChild>
        <button
          ref={badgeRef}
          type="button"
          data-verse-reference={verse.full_reference}
          className={cn(
            "group inline-flex items-center gap-1 mx-1 transition-all duration-300",
            isActive && "scale-105"
          )}
          onClick={() => setOpen((prev) => !prev)}
        >
          <Badge
            variant="outline"
            className={cn(
              "font-mono text-xs transition-all cursor-pointer",
              isActive
                ? "border-accent text-accent bg-accent/20 shadow-[0_0_15px_rgba(255,165,0,0.4)]"
                : "border-accent/50 text-accent bg-accent/10 hover:bg-accent/20 hover:border-accent/70"
            )}
          >
            {content}
          </Badge>
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
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Verse</span>
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
          {readerUrl && (
            <div className="pt-1">
              <a
                href={readerUrl}
                className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-accent hover:text-accent/80"
              >
                <BookOpen className="size-3.5" />
                <span>Open in reader</span>
              </a>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * Parses content for verse references and replaces them with clickable badges
 * Looks for patterns like [Book Chapter:Verse] or [Book Chapter:Verse-Verse]
 */
export function VerseRichText({
  content,
  verses,
  activeVerseIds = new Set(),
  onVerseEnter,
  onVerseLeave,
}: VerseInlineProps) {
  // Create a map of verse references for quick lookup
  const verseMap = new Map<string, VerseReference>();
  verses.forEach((verse) => {
    verseMap.set(verse.full_reference, verse);
  });

  // Pattern to match verse references in brackets: [Book Chapter:Verse] or [Book Chapter:Verse-Verse]
  const versePattern = /\[([^\]]+)\]/g;

  const parts: Array<{ type: "text" | "verse"; content: string; verse?: VerseReference }> = [];
  let lastIndex = 0;
  let match;

  while ((match = versePattern.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: content.substring(lastIndex, match.index),
      });
    }

    // Check if the matched text is a verse reference
    const reference = match[1];
    const verse = verseMap.get(reference);

    if (verse) {
      parts.push({
        type: "verse",
        content: reference,
        verse,
      });
    } else {
      // Not a verse reference, keep as text
      parts.push({
        type: "text",
        content: match[0], // Include the brackets
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({
      type: "text",
      content: content.substring(lastIndex),
    });
  }

  // If no matches, return content as-is
  if (parts.length === 0) {
    return <p className="font-mono text-sm text-foreground leading-relaxed whitespace-pre-wrap">{content}</p>;
  }

  return (
    <p className="font-mono text-sm text-foreground leading-relaxed">
      {parts.map((part, index) => {
        if (part.type === "verse" && part.verse) {
          const verseId = part.verse.full_reference;
          const isActive = activeVerseIds.has(verseId);
          return (
            <VerseBadgeComponent
              key={index}
              verse={part.verse}
              content={part.content}
              isActive={isActive}
              onEnter={() => onVerseEnter?.(verseId)}
              onLeave={() => onVerseLeave?.(verseId)}
            />
          );
        }
        return <span key={index}>{part.content}</span>;
      })}
    </p>
  );
}
