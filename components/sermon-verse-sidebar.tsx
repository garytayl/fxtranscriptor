"use client";

import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";
import { getReaderUrlFromReference } from "@/lib/bible/reference";
import { cn } from "@/lib/utils";

export type VerseLike = {
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number | null;
  full_reference: string;
};

export type OrganizedVerses = {
  mainChapter: { key: string; verses: VerseLike[] } | null;
  supportingVerses: VerseLike[];
};

interface SermonVerseSidebarProps {
  organizedVerses: OrganizedVerses;
  className?: string;
}

/**
 * Page-level sidebar listing all scripture references for a sermon.
 * Shown on sermon detail when verses exist; links to Bible reader. Scrolls with the page.
 */
export function SermonVerseSidebar({ organizedVerses, className }: SermonVerseSidebarProps) {
  const { mainChapter, supportingVerses } = organizedVerses;
  const hasAny =
    (mainChapter && mainChapter.verses.length > 0) || supportingVerses.length > 0;
  if (!hasAny) return null;

  const total =
    (mainChapter?.verses.length ?? 0) + supportingVerses.length;

  return (
    <aside
      data-sermon-verse-sidebar
      className={cn("w-full z-20 h-full min-h-0 flex flex-col", className)}
    >
      <div className="bg-card/95 backdrop-blur-sm border border-border/30 rounded-lg p-4 shadow-lg flex flex-col h-full min-h-0">
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border/30 flex-shrink-0">
          <BookOpen className="size-4 text-accent" />
          <h3 className="font-mono text-xs uppercase tracking-widest text-foreground">
            Scripture
          </h3>
          <Badge variant="secondary" className="font-mono text-[10px] ml-auto">
            {total}
          </Badge>
        </div>

        <div className="space-y-4 flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 scrollbar-thin scrollbar-thumb-accent/20 scrollbar-track-transparent">
          {mainChapter && mainChapter.verses.length > 0 && (
            <div>
              <h4 className="font-mono text-[10px] uppercase tracking-widest text-accent mb-2 px-1">
                Main: {mainChapter.key}
              </h4>
              <div className="space-y-1.5">
                {mainChapter.verses.map((verse) => (
                  <VerseLink key={verse.full_reference} verse={verse} />
                ))}
              </div>
            </div>
          )}
          {supportingVerses.length > 0 && (
            <div>
              <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 px-1">
                Other references
              </h4>
              <div className="space-y-1.5">
                {supportingVerses.map((verse) => (
                  <VerseLink key={verse.full_reference} verse={verse} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function VerseLink({ verse }: { verse: VerseLike }) {
  const url = getReaderUrlFromReference(verse.full_reference);
  return (
    <a
      href={url ?? "#"}
      target={url ? "_blank" : undefined}
      rel={url ? "noopener noreferrer" : undefined}
      className="flex items-center justify-between gap-2 w-full text-left p-2.5 rounded-lg border border-border/30 bg-card/50 hover:border-accent/50 hover:bg-card/80 transition-all group"
    >
      <Badge
        variant="outline"
        className="font-mono text-xs border-accent/30 text-foreground group-hover:border-accent/70"
      >
        {verse.full_reference}
      </Badge>
      {url && (
        <BookOpen className="size-3 text-muted-foreground group-hover:text-accent flex-shrink-0" />
      )}
    </a>
  );
}
