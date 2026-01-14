"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Loader2 } from "lucide-react";
import { VerseRichText } from "@/components/verse-inline";
import type { UnifiedSummarySection } from "@/app/api/sermons/[id]/summaries/unified/route";

interface UnifiedSermonSummaryProps {
  sections: UnifiedSummarySection[];
  loading?: boolean;
}

/**
 * Unified sermon summary component with accordion navigation
 * Displays sections with inline verse citations
 */
export function UnifiedSermonSummary({ sections, loading }: UnifiedSermonSummaryProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(["section-0"]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-accent" />
        <span className="ml-3 font-mono text-sm text-muted-foreground">
          Generating unified summary...
        </span>
      </div>
    );
  }

  if (!sections || sections.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="font-mono text-sm text-muted-foreground">
          No sections available.
        </p>
      </div>
    );
  }

  return (
    <Accordion
      type="multiple"
      value={expandedSections}
      onValueChange={setExpandedSections}
      className="space-y-3"
    >
      {sections.map((section, index) => (
        <AccordionItem key={index} value={`section-${index}`}>
          <AccordionTrigger>
            <div className="flex items-start justify-between w-full pr-4">
              <div className="flex-1 text-left">
                <h3 className="font-mono text-sm font-semibold text-foreground mb-1">
                  {section.title}
                </h3>
                {section.verses.length > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="secondary"
                      className="font-mono text-[10px] border-accent/30"
                    >
                      <BookOpen className="size-3 mr-1" />
                      {section.verses.length} {section.verses.length === 1 ? "verse" : "verses"}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <VerseRichText content={section.content} verses={section.verses} />
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
