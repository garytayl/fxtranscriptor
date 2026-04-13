import { describe, expect, it } from "vitest"

import { expandGreekMorphToken } from "@/lib/bible/robinson-greek"

describe("expandGreekMorphToken", () => {
  it("expands imperfect active indicative singular (εἰμί)", () => {
    const out = expandGreekMorphToken({
      text: "ἦν",
      word: "ἦν",
      lemma: "εἰμί",
      pos: "V-",
      parse: "3IAI-S--",
    })
    expect(out.parseSummary).toContain("imperfect")
    expect(out.parseSummary).toContain("indicative")
    expect(out.parseSummary).toContain("singular")
    expect(out.plainEnglishLead.length).toBeGreaterThan(10)
    expect(out.learningSections.length).toBeGreaterThan(0)
  })

  it("expands nominative noun", () => {
    const out = expandGreekMorphToken({
      text: "λόγος",
      word: "λόγος",
      lemma: "λόγος",
      pos: "N-",
      parse: "----NSM-",
    })
    expect(out.parseSummary).toContain("nominative")
    expect(out.parseSummary).toContain("masculine")
  })

  it("handles indeclinable preposition", () => {
    const out = expandGreekMorphToken({
      text: "ἐν",
      word: "ἐν",
      lemma: "ἐν",
      pos: "P-",
      parse: "--------",
    })
    expect(out.parseSummary).toMatch(/indeclinable/i)
  })

  it("expands present active participle nominative singular masculine", () => {
    const out = expandGreekMorphToken({
      text: "λέγων",
      word: "λέγων",
      lemma: "λέγω",
      pos: "V-",
      parse: "-PAPNSM-",
    })
    expect(out.parseSummary).toContain("participle")
    expect(out.parseSummary).toContain("nominative")
    expect(out.learningSections.some((s) => /participle/i.test(s.title))).toBe(true)
  })
})
