"use client"

import React from "react"

/**
 * Renders verse text that may contain <em>...</em> from API.Bible (emphasis / supplied words)
 * and footnote markers like [a], [b]. When footnotes map is provided, each marker is rendered
 * with a title tooltip so the same letter in the verse matches its footnote.
 */
export function VerseText({
  text,
  className,
  footnotesByMarker,
}: {
  text: string
  className?: string
  /** Map marker letter -> footnote text (e.g. { a: "Or created the universe" }) for tooltips. */
  footnotesByMarker?: Record<string, string>
}) {
  if (!text) return null

  const stripped = text.replace(/<[^>]+>/g, (tag) => {
    const lower = tag.toLowerCase()
    if (lower === "<em>" || lower === "</em>") return tag
    return " "
  })

  const segments = stripped.split(/(<em>|<\/em>|\[[a-z]\])/gi)
  const parts: React.ReactNode[] = []
  let inEm = false
  let key = 0
  for (const seg of segments) {
    if (seg.toLowerCase() === "<em>") {
      inEm = true
      continue
    }
    if (seg.toLowerCase() === "</em>") {
      inEm = false
      continue
    }
    const markerMatch = seg.match(/^\[([a-z])\]$/i)
    if (markerMatch && footnotesByMarker) {
      const letter = markerMatch[1].toLowerCase()
      const note = footnotesByMarker[letter]
      if (note) {
        parts.push(
          <span
            key={key++}
            className="cursor-help border-b border-dotted border-muted-foreground/50"
            title={note}
          >
            {seg}
          </span>
        )
        continue
      }
    }
    if (inEm) {
      parts.push(<em key={key++}>{seg}</em>)
    } else {
      parts.push(seg)
    }
  }

  return <span className={className}>{parts}</span>
}
