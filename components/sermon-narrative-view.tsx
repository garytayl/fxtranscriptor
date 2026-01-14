"use client";

import { useState, useRef, useEffect } from "react";
import { SectionReveal } from "@/components/section-reveal";
import { VerseSidePanel } from "@/components/verse-side-panel";
import { VerseConnections } from "@/components/verse-connections";
import { VerseRichText } from "@/components/verse-inline";
import { Loader2 } from "lucide-react";
import type { UnifiedSummarySection } from "@/app/api/sermons/[id]/summaries/unified/route";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface SermonNarrativeViewProps {
  sections: UnifiedSummarySection[];
  loading?: boolean;
}

/**
 * Scroll-driven narrative view with verse connections
 */
export function SermonNarrativeView({ sections, loading }: SermonNarrativeViewProps) {
  const [activeSection, setActiveSection] = useState<number>(0);
  const [activeVerseIds, setActiveVerseIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // Track active section on scroll
  useEffect(() => {
    if (!containerRef.current) return;

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
  }, [sections]);

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

  return (
    <div ref={containerRef} className="relative flex gap-6">
      {/* Verse Connections Overlay */}
      <VerseConnections
        sections={sections}
        activeVerseIds={activeVerseIds}
        containerRef={containerRef}
      />

      {/* Main Content */}
      <div className="relative z-0 flex-1 min-w-0">
        {sections.map((section, index) => (
          <SectionReveal
            key={index}
            section={section}
            index={index}
            isActive={activeSection === index}
          >
            <VerseRichText
              content={section.content}
              verses={section.verses}
              activeVerseIds={activeVerseIds}
              onVerseEnter={handleVerseEnter}
              onVerseLeave={handleVerseLeave}
            />
          </SectionReveal>
        ))}
      </div>

      {/* Verse Side Panel - Sticky on right */}
      <div className="hidden lg:block flex-shrink-0 w-64 self-start">
        <VerseSidePanel
          sections={sections}
          activeVerseIds={activeVerseIds}
          onVerseClick={handleVerseClick}
        />
      </div>
    </div>
  );
}
