import { describe, expect, it } from "vitest"
import { fillTrailingPlainStrongs } from "@/lib/bible/strongs-tail-guess"
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

  it("keeps multi-word spans before [G#] as one phrase sharing that Strong's code", () => {
    const en = "in[G1] the daily[G2] ministration."
    const pairs = parseEnToWordsAndCodes(en)
    expect(pairs).toEqual([
      { word: "in", code: "G1" },
      { word: "the daily", code: "G2" },
      { word: "ministration.", code: "" },
    ])
  })

  it("groups imperative phrases like look ye out under one Strong's", () => {
    const en =
      "Wherefore,[G3767] brethren,[G80] look ye out[G1980] among[G1537] you[G5216] seven[G2033] men[G435]"
    const pairs = parseEnToWordsAndCodes(en)
    const lookPhrase = pairs.find((p) => p.word.includes("look"))
    expect(lookPhrase).toEqual({ word: "look ye out", code: "G1980" })
  })

  it("fills trailing untagged Kaiserlik words with Greek Strong's (NT) when uniquely guessable", () => {
    const en = "in[G1722] the daily[G2522] ministration."
    const parsed = parseEnToWordsAndCodes(en)
    const filled = fillTrailingPlainStrongs(parsed, "ACT")
    const last = filled[filled.length - 1]
    expect(last?.word).toMatch(/^ministration/)
    expect(last?.code).toBe("G3009")
  })

  it("uses overrides for ambiguous plural tails (e.g. tables)", () => {
    const en = "serve[G1247] tables."
    const filled = fillTrailingPlainStrongs(parseEnToWordsAndCodes(en), "ACT")
    expect(filled[filled.length - 1]).toEqual({ word: "tables.", code: "G5132" })
  })
})
