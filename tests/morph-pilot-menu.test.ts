import { describe, expect, it } from "vitest"

import { FX_GREEK_GRAMMAR_TRANSLATION_KEY } from "@/lib/bible/reader-translation-keys"
import { MORPH_PILOT_CHAPTERS, morphPilotPassageRef, morphPilotReaderUrl } from "@/lib/bible/morph-pilot-menu"

describe("morphPilotPassageRef", () => {
  it("builds API ref strings for pilot chapters", () => {
    expect(morphPilotPassageRef(MORPH_PILOT_CHAPTERS[0], 12)).toBe("John 1:12")
    expect(morphPilotPassageRef(MORPH_PILOT_CHAPTERS[1], 3)).toBe("Luke 6:3")
  })
})

describe("morphPilotReaderUrl", () => {
  it("builds bible URL with fx-greek and verse highlight", () => {
    const u = morphPilotReaderUrl("luke", 6, 12)
    expect(u).toBe(`/bible/luke/6?t=${FX_GREEK_GRAMMAR_TRANSLATION_KEY}&v=12`)
  })
})
