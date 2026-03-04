"use client"

import React from "react"

/**
 * Renders verse text that may contain <em>...</em> from API.Bible (emphasis / supplied words).
 * Renders <em> as italic; strips any other HTML tags for safety.
 */
export function VerseText({ text, className }: { text: string; className?: string }) {
  if (!text) return null

  const parts: React.ReactNode[] = []
  const stripped = text.replace(/<[^>]+>/g, (tag) => {
    const lower = tag.toLowerCase()
    if (lower === "<em>" || lower === "</em>") return tag
    return " "
  })
  const segments = stripped.split(/(<em>|<\/em>)/gi)
  let inEm = false
  for (const seg of segments) {
    if (seg.toLowerCase() === "<em>") {
      inEm = true
      continue
    }
    if (seg.toLowerCase() === "</em>") {
      inEm = false
      continue
    }
    if (inEm) {
      parts.push(<em key={parts.length}>{seg}</em>)
    } else {
      parts.push(seg)
    }
  }

  return <span className={className}>{parts}</span>
}
