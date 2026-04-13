import { describe, expect, it } from "vitest"

import { FX_GREEK_GRAMMAR_TRANSLATION_KEY } from "@/lib/bible/reader-translation-keys"
import { withFxGreekTranslation } from "@/lib/bible/with-fx-greek-translation"

describe("withFxGreekTranslation", () => {
  it("appends fx-greek when missing", () => {
    const out = withFxGreekTranslation([
      { key: "hcsb", label: "HCSB", bibleId: "local-HCSB" },
      { key: "webu", label: "WEBU", bibleId: "x" },
    ])
    expect(out.some((t) => t.key === FX_GREEK_GRAMMAR_TRANSLATION_KEY)).toBe(true)
  })

  it("does not duplicate", () => {
    const base = [
      { key: "kjv", label: "KJV", bibleId: "de4e12af7f28f599-01" },
      {
        key: FX_GREEK_GRAMMAR_TRANSLATION_KEY,
        label: "FX",
        bibleId: "local-FX-GREEK-GRAMMAR",
      },
    ]
    expect(withFxGreekTranslation(base).length).toBe(2)
  })
})
