import { getBookTestament } from "@/lib/bible/constants"
import type { StrongsWordAndCode } from "@/lib/bible/verse-strongs"

import uniqueEnglish from "@/lib/bible/data/strongs-kjv-unique-english.json"
import overrides from "@/lib/bible/data/strongs-fallback-overrides.json"

type TestamentKind = "old" | "new" | "unknown"

/** Strip punctuation; keep apostrophes inside words (e.g. God's). */
function normalizeEnglishSurfaceWord(surface: string): string {
  return surface
    .replace(/^[^a-zA-Z']+/, "")
    .replace(/[^a-zA-Z']+$/, "")
    .toLowerCase()
}

function guessStrongsForSurfaceWord(surface: string, testament: TestamentKind): string | null {
  if (testament === "unknown") return null
  const lang = testament === "new" ? "greek" : "hebrew"
  const w = normalizeEnglishSurfaceWord(surface)
  if (w.length < 2) return null

  const ovr = (overrides as { greek: Record<string, string>; hebrew: Record<string, string> })[lang]
  if (ovr[w]) return ovr[w]

  const uniq = (uniqueEnglish as { greek: Record<string, string>; hebrew: Record<string, string> })[lang]
  if (uniq[w]) return uniq[w]

  if (w.endsWith("s") && w.length > 4) {
    const singular = w.slice(0, -1)
    if (ovr[singular]) return ovr[singular]
    if (uniq[singular]) return uniq[singular]
  }

  return null
}

/**
 * Kaiserlik often omits the final `[G#]`/`[H#]` on the last word(s). After parsing, the
 * trailing run of segments has `code: ""`. Fill those from OpenScriptures kjv_def reverse
 * index (unique glosses) plus small overrides — never middle plain words (e.g. leading "the"
 * in a multi-word span).
 */
export function fillTrailingPlainStrongs(
  pairs: StrongsWordAndCode[],
  apiBookId: string
): StrongsWordAndCode[] {
  if (pairs.length === 0) return pairs
  const testament = getBookTestament(apiBookId)
  if (testament === "unknown") return pairs

  let i = pairs.length - 1
  while (i >= 0 && pairs[i].code === "") {
    i--
  }
  const trailingStart = i + 1
  if (trailingStart >= pairs.length) return pairs

  const t: TestamentKind = testament === "old" ? "old" : "new"
  return pairs.map((p, idx) => {
    if (idx < trailingStart) return p
    const code = guessStrongsForSurfaceWord(p.word, t)
    return code ? { ...p, code } : p
  })
}
