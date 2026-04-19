import { GREEK_LEMMA_ENGLISH_QUIZ } from "@/lib/bible/greek-lemma-english-gloss.generated"
import { normalizeGreekLemma, strongsCodeForGreekLemma } from "@/lib/bible/greek-lemma-english-quiz"

export type GreekLemmaEnglishHit = {
  lemma: string
  gloss: string
  strongsCode: string | null
  score: number
}

type SearchRow = {
  lemma: string
  gloss: string
  paddedNorm: string
}

/** Lowercase, strip diacritics on Latin letters, collapse punctuation to spaces. */
export function normalizeEnglishForSearch(text: string): string {
  const lower = text.toLowerCase().normalize("NFD")
  const ascii = lower.replace(/\p{M}/gu, "")
  return ascii.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim()
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function buildRows(): SearchRow[] {
  return Object.entries(GREEK_LEMMA_ENGLISH_QUIZ).map(([lemma, gloss]) => {
    const norm = normalizeEnglishForSearch(gloss)
    return {
      lemma,
      gloss,
      paddedNorm: norm ? ` ${norm} ` : " ",
    }
  })
}

const ROWS: SearchRow[] = buildRows()

function scoreSingleToken(row: SearchRow, token: string): number {
  const { paddedNorm } = row
  const spacedToken = ` ${token} `
  if (paddedNorm.includes(spacedToken)) {
    const idx = paddedNorm.indexOf(spacedToken)
    return 100 - Math.min(30, idx / 4)
  }
  const tokens = row.paddedNorm.trim().split(/\s+/).filter(Boolean)
  for (const w of tokens) {
    if (w === token) return 95
    if (w.startsWith(token) && token.length >= 3) return 82
  }
  if (paddedNorm.includes(token)) {
    const idx = paddedNorm.indexOf(token)
    return 65 - Math.min(20, idx / 6)
  }
  return 0
}

function allTokensMatch(row: SearchRow, tokens: string[]): boolean {
  for (const t of tokens) {
    const spaced = ` ${t} `
    if (!row.paddedNorm.includes(spaced) && !row.paddedNorm.trim().split(/\s+/).some((w) => w.includes(t))) {
      return false
    }
  }
  return true
}

/**
 * Search Greek lemmas by English gloss (Strong's–derived short definitions in `GREEK_LEMMA_ENGLISH_QUIZ`).
 * Minimum two characters after normalization. Multi-word queries require every word to match somewhere in the gloss.
 */
export function searchGreekLemmasByEnglish(query: string, opts?: { limit?: number }): GreekLemmaEnglishHit[] {
  const limit = opts?.limit ?? 100
  const qNorm = normalizeEnglishForSearch(query)
  if (qNorm.length < 2) return []

  const qTokens = qNorm.split(/\s+/).filter((t) => t.length > 0)
  if (qTokens.length === 0) return []

  const hits: GreekLemmaEnglishHit[] = []

  for (const row of ROWS) {
    let score = 0
    if (qTokens.length === 1) {
      score = scoreSingleToken(row, qTokens[0])
    } else {
      if (!allTokensMatch(row, qTokens)) continue
      score = 55
      for (const t of qTokens) {
        score += Math.min(12, t.length)
        if (` ${row.paddedNorm} `.includes(` ${t} `)) score += 8
      }
    }

    if (score <= 0) continue

    const lemmaKey = normalizeGreekLemma(row.lemma)
    hits.push({
      lemma: lemmaKey,
      gloss: row.gloss,
      strongsCode: strongsCodeForGreekLemma(lemmaKey),
      score,
    })
  }

  hits.sort((a, b) => b.score - a.score || a.lemma.localeCompare(b.lemma, "el"))
  return hits.slice(0, limit)
}
