"use client";

import { useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ExternalLink } from "lucide-react";
import { getBibleGatewayUrlFromReference } from "@/lib/bibleGateway";
import type { UnifiedSummarySection } from "@/app/api/sermons/[id]/summaries/unified/route";
import { cn } from "@/lib/utils";

interface VerseSidePanelProps {
  sections: UnifiedSummarySection[];
  activeVerseIds: Set<string>;
  onVerseClick?: (verseId: string) => void;
}

interface VerseCardProps {
  verse: {
    book: string;
    chapter: number;
    verse_start: number;
    verse_end: number | null;
    full_reference: string;
  };
  isActive: boolean;
  onClick?: () => void;
}

function VerseCard({ verse, isActive, onClick }: VerseCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-all duration-300 group",
        isActive
          ? "border-accent bg-accent/10 shadow-[0_0_20px_rgba(255,165,0,0.3)]"
          : "border-border/30 bg-card/50 hover:border-accent/50 hover:bg-card/80"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Badge
          variant="outline"
          className={cn(
            "font-mono text-xs transition-all",
            isActive
              ? "border-accent/70 text-accent bg-accent/20"
              : "border-accent/30 text-foreground"
          )}
        >
          {verse.full_reference}
        </Badge>
        <a
          href={getBibleGatewayUrlFromReference(verse.full_reference)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ExternalLink className="size-3 text-muted-foreground hover:text-accent" />
        </a>
      </div>
    </button>
  );
}

/**
 * Sticky verse side panel that highlights active verses
 */
export function VerseSidePanel({
  sections,
  activeVerseIds,
  onVerseClick,
}: VerseSidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Group verses by section for better organization
  const versesBySection = sections
    .map((section, index) => ({
      sectionTitle: section.title,
      sectionIndex: index,
      verses: section.verses,
    }))
    .filter((group) => group.verses.length > 0);

  // Count total unique verses
  const uniqueVerseSet = new Set<string>();
  versesBySection.forEach((group) => {
    group.verses.forEach((verse) => uniqueVerseSet.add(verse.full_reference));
  });
  const totalVerses = uniqueVerseSet.size;

  return (
    <aside
      ref={panelRef}
      data-verse-sidebar
      className="sticky top-6 w-full max-h-[calc(100vh-3rem)] overflow-y-auto z-20 scrollbar-thin scrollbar-thumb-accent/20 scrollbar-track-transparent"
      style={{ alignSelf: 'flex-start' }}
    >
      <div className="bg-card/95 backdrop-blur-sm border border-border/30 rounded-lg p-4 space-y-4 shadow-lg">
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border/30">
          <BookOpen className="size-4 text-accent" />
          <h3 className="font-mono text-xs uppercase tracking-widest text-foreground">
            Verses Referenced
          </h3>
          <Badge variant="secondary" className="font-mono text-[10px] ml-auto">
            {totalVerses}
          </Badge>
        </div>

        <div className="space-y-3">
          {versesBySection.map((sectionGroup) => (
            <div key={sectionGroup.sectionIndex} className="space-y-2">
              <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-2">
                {sectionGroup.sectionTitle}
              </h4>
              <div className="space-y-1.5">
                {sectionGroup.verses.map((verse) => {
                  const verseId = verse.full_reference;
                  const isActive = activeVerseIds.has(verseId);
                  return (
                    <VerseCard
                      key={verseId}
                      verse={verse}
                      isActive={isActive}
                      onClick={() => onVerseClick?.(verseId)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
