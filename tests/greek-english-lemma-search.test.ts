import { describe, expect, it } from "vitest"

import {
  normalizeEnglishForSearch,
  searchGreekLemmasByEnglish,
} from "@/lib/greek-english-lemma-search"

describe("greek-english-lemma-search", () => {
  it("normalizes English for matching", () => {
    expect(normalizeEnglishForSearch("  Love,  GOOD ")).toBe("love good")
  })

  it("returns empty for short query", () => {
    expect(searchGreekLemmasByEnglish("")).toEqual([])
    expect(searchGreekLemmasByEnglish("a")).toEqual([])
  })

  it("finds love-related lemmas", () => {
    const hits = searchGreekLemmasByEnglish("love", { limit: 40 })
    const lemmas = new Set(hits.map((h) => h.lemma))
    expect(lemmas.has("ἀγαπάω")).toBe(true)
    expect(hits.some((h) => h.gloss.toLowerCase().includes("love"))).toBe(true)
    expect(hits.length).toBeGreaterThan(3)
  })

  it("supports multi-word gloss search", () => {
    const hits = searchGreekLemmasByEnglish("most holy", { limit: 20 })
    expect(hits.length).toBeGreaterThan(0)
    const glossBlob = hits.map((h) => h.gloss).join(" ").toLowerCase()
    expect(glossBlob.includes("holy") && glossBlob.includes("most")).toBe(true)
  })
})
