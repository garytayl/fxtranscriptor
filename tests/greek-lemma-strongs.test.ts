import { describe, expect, it } from "vitest"

import { strongsCodeForGreekLemma } from "@/lib/bible/greek-lemma-english-quiz"

describe("strongsCodeForGreekLemma", () => {
  it("returns OpenScriptures Strong's code for known lemmas", () => {
    expect(strongsCodeForGreekLemma("θεός")).toBe("G2316")
  })

  it("returns null for unknown lemma", () => {
    expect(strongsCodeForGreekLemma("")).toBeNull()
    expect(strongsCodeForGreekLemma("not-a-real-lemma-xyz")).toBeNull()
  })
})
