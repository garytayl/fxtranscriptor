"use client";

import { BookOpen, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SermonMetadataProps {
  series: string | null;
  speaker: string | null;
  className?: string;
}

export function SermonMetadata({ series, speaker, className = "" }: SermonMetadataProps) {
  if (!series && !speaker) {
    return null;
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {series && (
        <Badge variant="secondary" className="gap-1.5 font-mono text-xs">
          <BookOpen className="size-3" />
          <span className="font-semibold">Series:</span>
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
