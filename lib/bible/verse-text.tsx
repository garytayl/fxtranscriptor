"use client"

import Link from "next/link"
import React from "react"

export type FootnoteByMarker = Record<string, string | { text: string; href?: string }>

/**
 * Strip all HTML tags from verse text (e.g. <em>, <strong> from API/imports). Keeps plain text only.
 */
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
}

/**
 * Renders verse text. All HTML tags (e.g. <em>, <strong>) are stripped so only plain text is shown.
 * Footnote markers like [a], [b] are preserved; when footnotesByMarker is provided, each marker
 * gets a title tooltip and optional cross-ref link.
 */
export function VerseText({
  text,
  className,
  footnotesByMarker,
}: {
  text: string
  className?: string
  /** Map marker letter -> footnote text or { text, href } for tooltips and optional cross-ref link. */
  footnotesByMarker?: FootnoteByMarker
}) {
  if (!text) return null

  const plain = stripHtmlTags(text)

  if (!footnotesByMarker) {
    return <span className={className}>{plain}</span>
  }

  const segments = plain.split(/(\[[a-z]\])/gi)
  const parts: React.ReactNode[] = []
  let key = 0
  for (const seg of segments) {
    const markerMatch = seg.match(/^\[([a-z])\]$/i)
    if (markerMatch) {
      const letter = markerMatch[1].toLowerCase()
      const note = footnotesByMarker[letter]
      if (note) {
        const title = typeof note === "string" ? note : note.text
        const href = typeof note === "string" ? undefined : note.href
        const spanClass = "cursor-help border-b border-dotted border-muted-foreground/50"
        if (href) {
          parts.push(
            <Link
              key={key++}
              href={href}
              className={spanClass + " hover:text-accent"}
              title={title}
            >
              {seg}
            </Link>
          )
        } else {
          parts.push(
            <span key={key++} className={spanClass} title={title}>
              {seg}
            </span>
          )
        }
        continue
      }
    }
    parts.push(seg)
  }

  return <span className={className}>{parts}</span>
}
