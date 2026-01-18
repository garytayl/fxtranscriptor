import type { BibleVerse } from "@/lib/bible/types"

const verseSpanRegex = /<span[^>]*class="[^"]*\bv\b[^"]*"[^>]*>(.*?)<\/span>/gi
const scriptStyleRegex = /<(script|style)[^>]*>[\s\S]*?<\/\1>/gi

const namedEntities: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&quot;": "\"",
  "&#39;": "'",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
}

function decodeHtmlEntities(value: string): string {
  let decoded = value
  for (const [entity, replacement] of Object.entries(namedEntities)) {
    decoded = decoded.replaceAll(entity, replacement)
  }

  decoded = decoded.replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_match, code) =>
    String.fromCharCode(Number.parseInt(code, 16))
  )

  return decoded
}

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ")
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function parseVerseNumber(markerHtml: string, markerContent: string): number | null {
  const dataNumberMatch = markerHtml.match(/data-number="(\d+)"/i)
  const numberText = dataNumberMatch?.[1] ?? stripHtmlTags(markerContent)
  const parsed = Number.parseInt(numberText, 10)
  if (!Number.isFinite(parsed)) {
    return null
  }
  return parsed
}

export function sanitizeChapterHtml(html: string): string {
  return html.replace(scriptStyleRegex, "")
}

export function parseChapterHtmlToVerses(html: string): BibleVerse[] {
  if (!html) {
    return []
  }

  const matches = Array.from(html.matchAll(verseSpanRegex))
  if (matches.length === 0) {
    const fallback = normalizeWhitespace(decodeHtmlEntities(stripHtmlTags(html)))
    return fallback ? [{ number: 1, text: fallback }] : []
  }

  const verses: BibleVerse[] = []
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]
    const markerHtml = match[0]
    const markerContent = match[1] ?? ""
    const verseNumber = parseVerseNumber(markerHtml, markerContent)
    if (!verseNumber) {
      continue
    }

    const startIndex = (match.index ?? 0) + markerHtml.length
    const endIndex = matches[index + 1]?.index ?? html.length
    const rawSegment = html.slice(startIndex, endIndex)
    const text = normalizeWhitespace(decodeHtmlEntities(stripHtmlTags(rawSegment)))
    if (!text) {
      continue
    }

    verses.push({ number: verseNumber, text })
  }

  return verses
}
