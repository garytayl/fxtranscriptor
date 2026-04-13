import { describe, expect, it } from "vitest"

import { buildGreekWordLearningClues } from "@/lib/bible/greek-word-learning-clues"

describe("buildGreekWordLearningClues", () => {
  it("explains why a nominal form is dative", () => {
    const out = buildGreekWordLearningClues({
      text: "χειρί",
      word: "χειρί",
      lemma: "χείρ",
      pos: "N-",
      parse: "----DSF-",
    })

    expect(out.quickReason).toContain("dative")
    expect(out.quickReason).toContain("----DSF-")
    expect(out.slotClues.join(" ")).toContain("Case slot (5): D = dative.")
    expect(out.slotClues.join(" ")).toContain("Number slot (6): S = singular.")
    expect(out.slotClues.join(" ")).toContain("Gender slot (7): F = feminine.")
  })

  it("explains article function for RA tokens", () => {
    const out = buildGreekWordLearningClues({
      text: "ὁ",
      word: "ὁ",
      lemma: "ὁ",
      pos: "RA",
      parse: "----NSM-",
    })

    expect(out.articleFunctionHint).toBeTruthy()
    expect(out.slotClues.join(" ")).toContain("Case slot (5): N = nominative.")
  })

  it("returns verb form clues for tense/voice/mood", () => {
    const out = buildGreekWordLearningClues({
      text: "ἐποίησεν",
      word: "ἐποίησεν",
      lemma: "ποιέω",
      pos: "V-",
      parse: "3AAI-S--",
    })

    expect(out.slotClues.join(" ")).toContain("Tense slot (2): A = aorist.")
    expect(out.slotClues.join(" ")).toContain("Voice slot (3): A = active.")
    expect(out.slotClues.join(" ")).toContain("Mood slot (4): I = indicative.")
  })
})
