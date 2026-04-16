import { describe, expect, it } from "vitest"

import { FX_GREEK_GRAMMAR_TRANSLATION_KEY } from "@/lib/bible/reader-translation-keys"
import { MORPH_PILOT_CHAPTERS, morphPilotPassageRef, morphPilotReaderUrl } from "@/lib/bible/morph-pilot-menu"

describe("morphPilotPassageRef", () => {
  it("builds API ref strings for pilot chapters", () => {
    const first = MORPH_PILOT_CHAPTERS[0]
    expect(morphPilotPassageRef(first, 12)).toBe(`${first.bookName} ${first.chapter}:12`)
    const luke6 = MORPH_PILOT_CHAPTERS.find((c) => c.bookSlug === "luke" && c.chapter === 6)
    expect(luke6).toBeDefined()
    expect(morphPilotPassageRef(luke6!, 3)).toBe("Luke 6:3")
  })
})

describe("morphPilotReaderUrl", () => {
  it("builds bible URL with fx-greek and verse highlight", () => {
    const u = morphPilotReaderUrl("luke", 6, 12)
    expect(u).toBe(`/bible/luke/6?t=${FX_GREEK_GRAMMAR_TRANSLATION_KEY}&v=12`)
  })
})
