import { describe, expect, it } from "vitest"
import { parseEnToWordsAndCodes } from "@/lib/bible/verse-strongs"

describe("parseEnToWordsAndCodes", () => {
  it("keeps untagged text after the last Strong's tag", () => {
    const en = "daily[G1234] ministration."
    const pairs = parseEnToWordsAndCodes(en)
    expect(pairs).toEqual([
      { word: "daily", code: "G1234" },
      { word: "ministration.", code: "" },
    ])
  })

  it("still handles twin tags on one word", () => {
    const en = "every[G3956][G444] man"
    const pairs = parseEnToWordsAndCodes(en)
    expect(pairs[0]).toEqual({ word: "every", code: "G3956" })
    expect(pairs[1]).toEqual({ word: "\u00b7", code: "G444" })
    expect(pairs[2]).toEqual({ word: "man", code: "" })
  })
})
