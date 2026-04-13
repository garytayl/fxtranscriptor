import { describe, expect, it } from "vitest"

import { resolveReaderTranslationToApiBibleId } from "@/lib/bible/fx-greek-reader-server"
import {
  FX_GREEK_GRAMMAR_TRANSLATION_KEY,
  LOCAL_FX_GREEK_GRAMMAR_BIBLE_ID,
} from "@/lib/bible/reader-translation-keys"

describe("fx-greek reader translation", () => {
  it("maps virtual bible id to a KJV API id", () => {
    const out = resolveReaderTranslationToApiBibleId(LOCAL_FX_GREEK_GRAMMAR_BIBLE_ID)
    expect(out).toMatch(/^[a-f0-9-]+$/)
    expect(out).not.toBe(LOCAL_FX_GREEK_GRAMMAR_BIBLE_ID)
  })

  it("uses a stable query key for reader links", () => {
    expect(FX_GREEK_GRAMMAR_TRANSLATION_KEY).toBe("fx-greek")
  })
})
