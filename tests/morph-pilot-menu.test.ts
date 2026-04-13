import { describe, expect, it } from "vitest"

import { FX_GREEK_GRAMMAR_TRANSLATION_KEY } from "@/lib/bible/reader-translation-keys"
import { morphPilotReaderUrl } from "@/lib/bible/morph-pilot-menu"

describe("morphPilotReaderUrl", () => {
  it("builds bible URL with fx-greek and verse highlight", () => {
    const u = morphPilotReaderUrl("luke", 6, 12)
    expect(u).toBe(`/bible/luke/6?t=${FX_GREEK_GRAMMAR_TRANSLATION_KEY}&v=12`)
  })
})
