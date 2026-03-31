import { describe, expect, it } from "vitest"

import { parsePassageReference, parseVerseRange, slugifyBookName } from "../lib/bible/reference"

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

describe("parsePassageReference", () => {
  it("parses same-chapter verse range", () => {
    const p = parsePassageReference("Galatians 4:8-18")
    expect(p).not.toBeNull()
    expect(p!.chapterNumber).toBe(4)
    expect(p!.verseRange).toEqual({ start: 8, end: 18 })
    expect(p!.crossChapterEnd).toBeUndefined()
  })

  it("parses cross-chapter range (Gal 4:8-5:1)", () => {
    const p = parsePassageReference("Galatians 4:8-5:1")
    expect(p).not.toBeNull()
    expect(p!.chapterNumber).toBe(4)
    expect(p!.verseRange).toEqual({ start: 8, end: 8 })
    expect(p!.crossChapterEnd).toEqual({ chapter: 5, verse: 1 })
  })

  it("parses explicit same-chapter c:v-c:v as one range", () => {
    const p = parsePassageReference("Galatians 4:8-4:31")
    expect(p).not.toBeNull()
    expect(p!.verseRange).toEqual({ start: 8, end: 31 })
    expect(p!.crossChapterEnd).toBeUndefined()
  })
})
