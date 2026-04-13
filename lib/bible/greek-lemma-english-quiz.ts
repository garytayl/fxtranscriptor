import { GREEK_LEMMA_ENGLISH_QUIZ } from "@/lib/bible/greek-lemma-english-gloss.generated"

export function normalizeGreekLemma(lemma: string): string {
  return lemma.normalize("NFC").trim()
}

export function englishGlossForLemma(lemma: string): string | null {
  const key = normalizeGreekLemma(lemma)
  return GREEK_LEMMA_ENGLISH_QUIZ[key] ?? null
}

/**
 * Labels for lemma quiz options in a verse. Uses short English glosses from Strong's
 * (generated map). When two lemmas share the same gloss, disambiguates with the Greek lemma in parentheses.
 */
export function buildLemmaQuizLabelMap(lemmas: string[]): Map<string, string> {
  const unique = Array.from(
    new Set(lemmas.map((l) => normalizeGreekLemma(l)).filter(Boolean)),
  )
  const baseByLemma = new Map<string, string>()
  for (const lemma of unique) {
    const english = englishGlossForLemma(lemma)
    baseByLemma.set(lemma, english ?? lemma)
  }
  const byBase = new Map<string, string[]>()
  for (const lemma of unique) {
    const b = baseByLemma.get(lemma)!
    const arr = byBase.get(b) ?? []
    arr.push(lemma)
    byBase.set(b, arr)
  }
  const out = new Map<string, string>()
  for (const lemma of unique) {
    const b = baseByLemma.get(lemma)!
    const group = byBase.get(b) ?? [lemma]
    if (group.length > 1) {
      out.set(lemma, `${b} (${lemma})`)
    } else {
      out.set(lemma, b)
    }
  }
  return out
}
