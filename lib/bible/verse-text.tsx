"use client"

import Link from "next/link"
import React from "react"

export type FootnoteByMarker = Record<string, string | { text: string; href?: string }>

/** Decode HTML entities (e.g. &lt;em&gt; → <em>). */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
}

/** Strip all tags except <em>/<strong>, then escape so only those render; safe for dangerouslySetInnerHTML. */
function safeVerseHtml(html: string): string {
  const decoded = decodeHtmlEntities(html)
  // Replace allowed tags with placeholders
  const PLACEHOLDER_EM_OPEN = "\u0001EMO\u0001"
  const PLACEHOLDER_EM_CLOSE = "\u0001EMC\u0001"
  const PLACEHOLDER_STRONG_OPEN = "\u0001SO\u0001"
  const PLACEHOLDER_STRONG_CLOSE = "\u0001SC\u0001"
  let s = decoded
    .replace(/<em\b[^>]*>/gi, PLACEHOLDER_EM_OPEN)
    .replace(/<\/em\s*>/gi, PLACEHOLDER_EM_CLOSE)
    .replace(/<strong\b[^>]*>/gi, PLACEHOLDER_STRONG_OPEN)
    .replace(/<\/strong\s*>/gi, PLACEHOLDER_STRONG_CLOSE)
  // Strip any remaining tags
  s = s.replace(/<[^>]+>/g, "")
  // Escape HTML in the text
  s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  // Restore allowed tags
  return s
    .replace(/\u0001EMO\u0001/g, "<em>")
    .replace(/\u0001EMC\u0001/g, "</em>")
    .replace(/\u0001SO\u0001/g, "<strong>")
    .replace(/\u0001SC\u0001/g, "</strong>")
}

/**
 * Renders verse text. <em> and <strong> are rendered as italic/bold (you see the styling, not the tags).
 * Uses sanitized innerHTML so the browser reliably renders them. Footnote markers [a], [b] get tooltips/links when footnotesByMarker is provided.
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

  const hasFootnotes = footnotesByMarker && Object.keys(footnotesByMarker).length > 0
  if (hasFootnotes) {
    // Footnote path: split by [a], [b] etc. and render; each segment without a footnote we render with safe HTML for em/strong
    const segments = text.split(/(\[[a-z]\])/gi)
    const parts: React.ReactNode[] = []
    let key = 0
    for (const seg of segments) {
      const markerMatch = seg.match(/^\[([a-z])\]$/i)
      if (markerMatch) {
        const letter = markerMatch[1].toLowerCase()
        const note = footnotesByMarker![letter]
        if (note) {
          const title = typeof note === "string" ? note : note.text
          const href = typeof note === "string" ? undefined : note.href
          const spanClass = "cursor-help border-b border-dotted border-muted-foreground/50"
          if (href) {
            parts.push(
              <Link key={key++} href={href} className={spanClass + " hover:text-accent"} title={title}>
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
        } else {
          parts.push(seg)
        }
      } else {
        parts.push(
          <span key={key++} dangerouslySetInnerHTML={{ __html: safeVerseHtml(seg) }} />
        )
      }
    }
    return <span className={className}>{parts}</span>
  }

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: safeVerseHtml(text) }}
    />
  )
}
