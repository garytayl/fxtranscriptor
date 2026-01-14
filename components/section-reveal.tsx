"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { UnifiedSummarySection } from "@/app/api/sermons/[id]/summaries/unified/route";

gsap.registerPlugin(ScrollTrigger);

interface SectionRevealProps {
  section: UnifiedSummarySection;
  index: number;
  isActive: boolean;
  onVerseHighlight?: (verseId: string) => void;
  children: React.ReactNode;
}

/**
 * Scroll-triggered section component with reveal animations
 */
export function SectionReveal({
  section,
  index,
  isActive,
  onVerseHighlight,
  children,
}: SectionRevealProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      // Section fade in and slide up
      gsap.fromTo(
        sectionRef.current,
        {
          opacity: 0,
          y: 30,
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power2.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 80%",
            end: "bottom 20%",
            toggleActions: "play none none reverse",
            markers: false,
          },
        }
      );

      // Title animation
      if (titleRef.current) {
        gsap.fromTo(
          titleRef.current,
          {
            opacity: 0,
            y: 20,
          },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: "power2.out",
            delay: 0.2,
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 80%",
              toggleActions: "play none none reverse",
              markers: false,
            },
          }
        );
      }

      // Content reveal
      if (contentRef.current) {
        gsap.fromTo(
          contentRef.current,
          {
            opacity: 0,
            x: 20,
          },
          {
            opacity: 1,
            x: 0,
            duration: 0.6,
            ease: "power2.out",
            delay: 0.3,
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 80%",
              toggleActions: "play none none reverse",
              markers: false,
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="min-h-screen flex flex-col justify-center px-6 md:px-28 py-32 relative"
      data-section-index={index}
    >
      <div className="max-w-4xl lg:max-w-3xl">
        <h2
          ref={titleRef}
          className="font-[var(--font-bebas)] text-4xl md:text-6xl lg:text-7xl tracking-tight mb-8 text-foreground"
        >
          {section.title}
        </h2>
        <div ref={contentRef} className="space-y-6">
          {children}
        </div>
      </div>
    </section>
  );
}
