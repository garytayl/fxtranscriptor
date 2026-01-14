"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExternalLink, BookOpen } from "lucide-react";
import type { SermonChunkVerse } from "@/lib/supabase";
import { getBibleGatewayUrl } from "@/lib/bibleGateway";
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
              <a
                href={getBibleGatewayUrl(verse)}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2 text-sm font-mono text-foreground hover:text-accent transition-colors"
              >
                <Badge
                  variant="outline"
                  className="font-mono text-xs border-accent/50 text-accent bg-accent/10 hover:bg-accent/20 hover:border-accent/70 transition-all"
                >
                  {verse.full_reference}
                </Badge>
                <ExternalLink className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
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

      {/* Modal for verse details */}
      <Dialog open={!!selectedVerse} onOpenChange={(open) => !open && setSelectedVerse(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-lg">
              {selectedVerse?.full_reference}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              View on Bible Gateway (HCSB translation)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground font-mono">
              Click the link below to read this passage on Bible Gateway with the HCSB translation.
            </p>
            {selectedVerse && (
              <Button
                asChild
                variant="outline"
                className="w-full font-mono text-xs uppercase tracking-widest"
              >
                <a
                  href={getBibleGatewayUrl(selectedVerse)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2"
                >
                  <BookOpen className="size-4" />
                  Read {selectedVerse.full_reference} on Bible Gateway
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
