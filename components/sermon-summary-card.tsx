"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import type { SermonChunkSummary, SermonChunkVerse } from "@/lib/supabase";
import { InlineVerseDisplay, VerseBadges } from "@/components/verse-display";

interface SermonSummaryCardProps {
  summary: SermonChunkSummary & { verses: SermonChunkVerse[] };
  index: number;
  mainChapterKey: string | null;
  isExpanded: boolean;
  onToggle: () => void;
}

/**
 * Card component for displaying a sermon chunk summary
 * Features expandable content, verse badges, and clean visual hierarchy
 */
export function SermonSummaryCard({
  summary,
  index,
  mainChapterKey,
  isExpanded,
  onToggle,
}: SermonSummaryCardProps) {
  // Separate verses into main chapter and supporting
  const mainChapterVerses = summary.verses.filter(
    (verse) => mainChapterKey && `${verse.book} ${verse.chapter}` === mainChapterKey
  );
  const supportingVerses = summary.verses.filter(
    (verse) => !mainChapterKey || `${verse.book} ${verse.chapter}` !== mainChapterKey
  );

  const hasVerses = summary.verses.length > 0;
  const previewText = summary.summary.substring(0, 120);

  return (
    <Card className="group hover:border-accent/40 transition-all duration-200 hover:shadow-[0_0_20px_rgba(255,165,0,0.1)]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant="outline"
                className="font-mono text-xs font-semibold text-accent border-accent/50 bg-accent/10"
              >
                Chunk {index + 1}
              </Badge>
              {hasVerses && (
                <Badge
                  variant="secondary"
                  className="font-mono text-[10px] border-accent/30"
                >
                  <BookOpen className="size-3 mr-1" />
                  {summary.verses.length} {summary.verses.length === 1 ? "verse" : "verses"}
                </Badge>
              )}
            </div>
            <p className="font-mono text-sm text-foreground leading-relaxed line-clamp-2">
              {isExpanded ? summary.summary : previewText}
              {!isExpanded && summary.summary.length > 120 && "..."}
            </p>
          </div>
          <button
            onClick={onToggle}
            className="flex-shrink-0 p-1 rounded hover:bg-muted transition-colors"
            aria-label={isExpanded ? "Collapse summary" : "Expand summary"}
          >
            {isExpanded ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Full Summary */}
          <div>
            <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Summary
            </h4>
            <p className="font-mono text-sm text-foreground leading-relaxed">
              {summary.summary}
            </p>
          </div>

          {/* Main Chapter Verses (Inline Expandable) */}
          {mainChapterVerses.length > 0 && (
            <div>
              <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                Main Chapter Verses
              </h4>
              <InlineVerseDisplay verses={mainChapterVerses} isMainChapter={true} />
            </div>
          )}

          {/* Supporting Verses (Badges with Modal) */}
          {supportingVerses.length > 0 && (
            <div>
              <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                Supporting Verses
              </h4>
              <VerseBadges verses={supportingVerses} />
            </div>
          )}

          {/* Fallback: If verses aren't categorized, show all as badges */}
          {hasVerses && mainChapterVerses.length === 0 && supportingVerses.length === 0 && (
            <div>
              <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                Bible Verses Referenced
              </h4>
              <VerseBadges verses={summary.verses} />
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
