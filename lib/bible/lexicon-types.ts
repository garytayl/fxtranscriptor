/**
 * Types for Greek/Hebrew word study (Strong's Concordance).
 * Used by studies and scripture reader to show original-language definitions.
 */

export type StrongsLanguage = "greek" | "hebrew"

export type StrongsEntry = {
  /** Strong's code, e.g. "G26" or "H3045" */
  code: string
  /** Original word (Greek or Hebrew) */
  lemma: string
  /** Transliteration (e.g. "agapē", "yādaʿ") */
  transliteration?: string
  /** Pronunciation hint */
  pronunciation?: string
  /** Short definition / gloss */
  meaning: string
  /** Optional longer definition */
  definition?: string
  language: StrongsLanguage
}

/** Parse "G26" or "H3045" into language and number. Returns null if invalid. */
export function parseStrongsCode(code: string): { language: StrongsLanguage; number: number } | null {
  const trimmed = (code || "").trim().toUpperCase()
  const match = trimmed.match(/^(G|H)(\d+)$/)
  if (!match) return null
  const num = parseInt(match[2], 10)
  if (!Number.isFinite(num)) return null
  return {
    language: match[1] === "G" ? "greek" : "hebrew",
    number: num,
  }
}

/** Normalize Strong's code to canonical form (e.g. "g26" -> "G26"). */
export function normalizeStrongsCode(code: string): string | null {
  const parsed = parseStrongsCode(code)
  if (!parsed) return null
  const prefix = parsed.language === "greek" ? "G" : "H"
  return `${prefix}${parsed.number}`
}
