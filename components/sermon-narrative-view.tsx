"use client";

import { useState, useRef, useEffect } from "react";
import { SectionReveal } from "@/components/section-reveal";
import { VerseSidePanel } from "@/components/verse-side-panel";
import { VerseConnections } from "@/components/verse-connections";
import { VerseRichText } from "@/components/verse-inline";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import type { UnifiedSummarySection } from "@/app/api/sermons/[id]/summaries/unified/route";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

const QUICK_READ_CHARS = 260;

function truncateAtWords(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > maxChars * 0.6 ? lastSpace : maxChars;
  return slice.slice(0, cut).trim();
}

interface SermonNarrativeViewProps {
  sections: UnifiedSummarySection[];
  loading?: boolean;
  /** When true, show truncated section content with "Read more". Default true for ~10 min read. */
  quickReadMode?: boolean;
  /** Toggle above sections: "Quick read" vs "Full" */
  onQuickReadToggle?: (quickRead: boolean) => void;
}

/**
 * Scroll-driven narrative view with verse connections.
 * Quick read mode shows ~260 chars per section with Expand to reduce scroll.
 */
export function SermonNarrativeView({
  sections,
  loading,
  quickReadMode = true,
  onQuickReadToggle,
}: SermonNarrativeViewProps) {
  const [activeSection, setActiveSection] = useState<number>(0);
  const [activeVerseIds, setActiveVerseIds] = useState<Set<string>>(new Set());
  const [reduceMotion, setReduceMotion] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // Track active section on scroll
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReduceMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (!containerRef.current || reduceMotion) return;

    const sectionElements = containerRef.current.querySelectorAll('[data-section-index]');
    
    const triggers = Array.from(sectionElements).map((section, index) => {
      return ScrollTrigger.create({
        trigger: section as HTMLElement,
        start: "top 60%",
        end: "bottom 40%",
        onEnter: () => setActiveSection(index),
        onEnterBack: () => setActiveSection(index),
        markers: false,
      });
    });

    return () => {
      triggers.forEach((trigger) => trigger.kill());
    };
  }, [sections, reduceMotion]);

  const handleVerseEnter = (verseId: string) => {
    setActiveVerseIds((prev) => {
      const next = new Set(prev);
      next.add(verseId);
      return next;
    });
  };

  const handleVerseLeave = (verseId: string) => {
    setActiveVerseIds((prev) => {
      const next = new Set(prev);
      next.delete(verseId);
      return next;
    });
  };

  const handleVerseClick = (verseId: string) => {
    // Scroll to verse in text
    const verseElement = containerRef.current?.querySelector(
      `[data-verse-reference="${verseId}"]`
    );
    if (verseElement) {
      verseElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 min-h-screen">
        <Loader2 className="size-6 animate-spin text-accent" />
        <span className="ml-3 font-mono text-sm text-muted-foreground">
          Generating narrative view...
        </span>
      </div>
    );
  }

  if (!sections || sections.length === 0) {
    return (
      <div className="text-center py-32 min-h-screen flex items-center justify-center">
        <p className="font-mono text-sm text-muted-foreground">
          No sections available.
        </p>
      </div>
    );
  }

  const toggleExpanded = (index: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Quick read / Full toggle */}
      {onQuickReadToggle && (
        <div className="flex items-center gap-2 mb-6">
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">View:</span>
          <div className="flex rounded-lg border border-border/50 p-0.5 bg-muted/30">
            <button
              type="button"
              onClick={() => onQuickReadToggle(true)}
              className={cn(
                "px-3 py-1.5 rounded-md font-mono text-xs uppercase tracking-widest transition-colors",
                quickReadMode ? "bg-accent/20 text-accent border border-accent/40" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Quick read
            </button>
            <button
              type="button"
              onClick={() => onQuickReadToggle(false)}
              className={cn(
                "px-3 py-1.5 rounded-md font-mono text-xs uppercase tracking-widest transition-colors",
                !quickReadMode ? "bg-accent/20 text-accent border border-accent/40" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Full
            </button>
          </div>
        </div>
      )}

      {/* Verse Connections Overlay */}
      {!reduceMotion && sections.length <= 8 && (
        <VerseConnections
          sections={sections}
          activeVerseIds={activeVerseIds}
          containerRef={containerRef}
        />
      )}

      {/* Flex Container for Content and Sidebar */}
      <div className="flex gap-6 items-start">
        {/* Main Content */}
        <div className="relative z-0 flex-1 min-w-0">
          {sections.map((section, index) => {
            const isTruncated = quickReadMode && !expandedSections.has(index) && section.content.length > QUICK_READ_CHARS;
            const showTruncated = isTruncated;
            const truncatedText = truncateAtWords(section.content, QUICK_READ_CHARS);

            return (
              <SectionReveal
                key={index}
                section={section}
                index={index}
                isActive={activeSection === index}
                enableAnimations={!reduceMotion}
              >
                {showTruncated ? (
                  <div className="space-y-4">
                    <p className="font-mono text-sm text-foreground leading-relaxed">
                      {truncatedText}
                      <span className="text-muted-foreground">…</span>
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="font-mono text-xs uppercase tracking-widest text-accent hover:text-accent"
                      onClick={() => toggleExpanded(index)}
                    >
                      <ChevronDown className="size-4 mr-1" />
                      Read more
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <VerseRichText
                      content={section.content}
                      verses={section.verses}
                      activeVerseIds={activeVerseIds}
                      onVerseEnter={handleVerseEnter}
                      onVerseLeave={handleVerseLeave}
                    />
                    {quickReadMode && section.content.length > QUICK_READ_CHARS && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
                        onClick={() => toggleExpanded(index)}
                      >
                        <ChevronUp className="size-4 mr-1" />
                        Show less
                      </Button>
                    )}
                  </div>
                )}
              </SectionReveal>
            );
          })}
        </div>

        {/* Verse Side Panel - Sticky on right */}
        <div className="hidden lg:block flex-shrink-0 w-64">
          <VerseSidePanel
            sections={sections}
            activeVerseIds={activeVerseIds}
            onVerseClick={handleVerseClick}
          />
        </div>
      </div>
    </div>
  );
}
