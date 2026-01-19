"use client";

import { BookOpen, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SermonMetadataProps {
  series: string | null;
  seriesOverride?: string | null;
  speaker: string | null;
  className?: string;
}

export function SermonMetadata({ series, seriesOverride, speaker, className = "" }: SermonMetadataProps) {
  if (!series && !seriesOverride && !speaker) {
    return null;
  }

  const displaySeries = seriesOverride || series;

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {displaySeries && (
        <Badge variant="secondary" className="gap-1.5 font-mono text-xs">
          <BookOpen className="size-3" />
          <span className="font-semibold">
            {seriesOverride ? "Series (override):" : "Series:"}
          </span>
          <span>{displaySeries}</span>
        </Badge>
      )}
      {seriesOverride && series && series !== seriesOverride && (
        <Badge variant="outline" className="gap-1.5 font-mono text-xs">
          <BookOpen className="size-3" />
          <span className="font-semibold">Original:</span>
          <span>{series}</span>
        </Badge>
      )}
      {speaker && (
        <Badge variant="outline" className="gap-1.5 font-mono text-xs">
          <User className="size-3" />
          <span className="font-semibold">Speaker:</span>
          <span>{speaker}</span>
        </Badge>
      )}
    </div>
  );
}
