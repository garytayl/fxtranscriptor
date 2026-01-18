"use client";

import { useEffect, useRef, useState } from "react";
import type { UnifiedSummarySection } from "@/app/api/sermons/[id]/summaries/unified/route";

interface VerseConnectionsProps {
  sections: UnifiedSummarySection[];
  activeVerseIds: Set<string>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface Connection {
  id: string;
  verseRef: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

/**
 * SVG overlay component that draws connection lines between verse badges and sidebar
 */
export function VerseConnections({
  sections,
  activeVerseIds,
  containerRef,
}: VerseConnectionsProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [connections, setConnections] = useState<Connection[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;
    if (!containerRef.current || !svgRef.current) return;

    const updateConnections = () => {
      const container = containerRef.current;
      const svg = svgRef.current;
      if (!container || !svg) return;

      const newConnections: Connection[] = [];
      
      // Calculate sidebar position (sticky on right side within container)
      const sidebarElement = container.querySelector('[data-verse-sidebar]');
      if (!sidebarElement) return;
      
      const sidebarRect = sidebarElement.getBoundingClientRect();
      const sidebarX = sidebarRect.left + sidebarRect.width / 2;
      const sidebarCenterY = sidebarRect.top + sidebarRect.height / 2;

      // Find all verse badges in the container
      const verseBadges = container.querySelectorAll('[data-verse-reference]');
      
      verseBadges.forEach((badge) => {
        const verseRef = badge.getAttribute('data-verse-reference');
        if (!verseRef || !activeVerseIds.has(verseRef)) return;

        const rect = badge.getBoundingClientRect();
        
        // Calculate positions relative to viewport (for fixed SVG)
        const startX = rect.left + rect.width / 2;
        const startY = rect.top + rect.height / 2;
        const endX = sidebarX;
        const endY = sidebarCenterY;

        newConnections.push({
          id: verseRef,
          verseRef,
          startX,
          startY,
          endX,
          endY,
        });
      });

      setConnections(newConnections);
    };

    // Update on scroll and resize
    const handleUpdate = () => {
      requestAnimationFrame(updateConnections);
    };

    window.addEventListener('scroll', handleUpdate, { passive: true });
    window.addEventListener('resize', handleUpdate);
    updateConnections();

    return () => {
      window.removeEventListener('scroll', handleUpdate);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [sections, activeVerseIds, containerRef]);

  if (connections.length === 0) return null;

  if (connections.length === 0) return null;

  return (
    <svg
      ref={svgRef}
      className="fixed inset-0 pointer-events-none z-10 hidden lg:block"
      style={{ width: '100vw', height: '100vh' }}
    >
      <defs>
        <linearGradient id="verseLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="oklch(0.7 0.2 45)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="oklch(0.7 0.2 45)" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      {connections.map((connection) => (
        <line
          key={connection.id}
          x1={connection.startX}
          y1={connection.startY}
          x2={connection.endX}
          y2={connection.endY}
          stroke="url(#verseLineGradient)"
          strokeWidth="2"
          strokeDasharray="6,4"
          style={{
            filter: 'drop-shadow(0 0 6px oklch(0.7 0.2 45 / 0.6))',
            transition: 'opacity 0.3s ease',
          }}
        />
      ))}
    </svg>
  );
}
