import { describe, expect, it } from "vitest"

import { parseVerseRange, slugifyBookName } from "../lib/bible/reference"

describe("slugifyBookName", () => {
  it("slugifies numbered books", () => {
    expect(slugifyBookName("1 John")).toBe("1-john")
    expect(slugifyBookName("2 Corinthians")).toBe("2-corinthians")
  })

  it("handles multi-word books", () => {
    expect(slugifyBookName("Song of Solomon")).toBe("song-of-solomon")
  })
})

describe("parseVerseRange", () => {
  it("parses a single verse", () => {
    expect(parseVerseRange("16")).toEqual({ start: 16, end: 16 })
  })

  it("parses a verse range", () => {
    expect(parseVerseRange("16-18")).toEqual({ start: 16, end: 18 })
  })

  it("rejects invalid ranges", () => {
    expect(parseVerseRange("18-16")).toBeNull()
    expect(parseVerseRange("0")).toBeNull()
    expect(parseVerseRange("abc")).toBeNull()
    expect(parseVerseRange("16-")).toBeNull()
  })
})
