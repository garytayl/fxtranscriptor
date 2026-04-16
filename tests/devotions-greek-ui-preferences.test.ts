import { describe, expect, it } from "vitest"

import { GREEK_UI_PREFERENCES_DEFAULTS, GREEK_UI_PREFS_STORAGE_KEY } from "@/lib/devotions-greek-ui-preferences"

describe("Greek UI preferences storage key", () => {
  it("uses a stable localStorage key", () => {
    expect(GREEK_UI_PREFS_STORAGE_KEY).toBe("fx_devotions_greek_v1_ui_prefs")
  })

  it("has sensible defaults", () => {
    expect(GREEK_UI_PREFERENCES_DEFAULTS).toEqual({
      wordHintsEnabled: false,
      showEnglish: true,
      reviewMode: false,
      soundEffectsEnabled: false,
      hapticsEnabled: false,
    })
  })
})
