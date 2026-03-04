"use client"

import Link from "next/link"
import React from "react"

export type FootnoteByMarker = Record<string, string | { text: string; href?: string }>

/** Remove only tags we don't render; keep <em> and <strong> so we can show italic/bold. */
function stripUnsafeTags(html: string): string {
  return html.replace(/<(?!\/?em\b|\/?strong\b)[^>]+>/gi, "").replace(/\s+/g, " ").trim()
}

/**
 * Renders verse text. <em> and <strong> are rendered as italic/bold (you see the styling, not the tags).
 * All other HTML tags are stripped. Footnote markers [a], [b] get tooltips/links when footnotesByMarker is provided.
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

  const cleaned = stripUnsafeTags(text)
  const segments = cleaned.split(/(<\/?em>|<\/?strong>)/gi)

  let inEm = false
  let inStrong = false
  let key = 0
  const parts: React.ReactNode[] = []

  function wrap(content: React.ReactNode): React.ReactNode {
    let node: React.ReactNode = content
    if (inStrong) node = <strong key={`s-${key++}`}>{node}</strong>
    if (inEm) node = <em key={`e-${key++}`}>{node}</em>
    return node
  }

  function renderTextSegment(seg: string): React.ReactNode[] {
    if (!seg) return []
    if (!footnotesByMarker) return [wrap(seg)]
    const subSegments = seg.split(/(\[[a-z]\])/gi)
    const nodes: React.ReactNode[] = []
    for (const sub of subSegments) {
      const markerMatch = sub.match(/^\[([a-z])\]$/i)
      if (markerMatch) {
        const letter = markerMatch[1].toLowerCase()
        const note = footnotesByMarker[letter]
        if (note) {
          const title = typeof note === "string" ? note : note.text
          const href = typeof note === "string" ? undefined : note.href
          const spanClass = "cursor-help border-b border-dotted border-muted-foreground/50"
          const markerNode = href ? (
            <Link key={key++} href={href} className={spanClass + " hover:text-accent"} title={title}>
              {sub}
            </Link>
          ) : (
            <span key={key++} className={spanClass} title={title}>
              {sub}
            </span>
          )
          nodes.push(wrap(markerNode))
        } else {
          nodes.push(wrap(sub))
        }
      } else {
        nodes.push(wrap(sub))
      }
    }
    return nodes
  }

  for (const seg of segments) {
    const lower = seg.toLowerCase()
    if (lower === "<em>") {
      inEm = true
      continue
    }
    if (lower === "</em>") {
      inEm = false
      continue
    }
    if (lower === "<strong>") {
      inStrong = true
      continue
    }
    if (lower === "</strong>") {
      inStrong = false
      continue
    }
    parts.push(...renderTextSegment(seg))
  }

  return <span className={className}>{parts}</span>
}
