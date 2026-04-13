import { describe, expect, it } from "vitest"

import { getGreekMorphTokensForChapter } from "@/lib/bible/morph-lookup"

describe("morph pilot chapters", () => {
  it("loads Matthew 1", () => {
    const ch = getGreekMorphTokensForChapter("matthew", 1)
    expect(ch).not.toBeNull()
    expect(ch![1]?.length).toBeGreaterThan(5)
  })

  it("loads John 1", () => {
    const ch = getGreekMorphTokensForChapter("john", 1)
    expect(ch).not.toBeNull()
    expect(ch![1]?.length).toBeGreaterThan(5)
  })

  it("loads Luke 6", () => {
    const ch = getGreekMorphTokensForChapter("luke", 6)
    expect(ch).not.toBeNull()
    expect(ch![1]?.length).toBeGreaterThan(5)
    expect(ch![49]?.length).toBeGreaterThan(0)
  })

  it("resolves Luke when URL slug or API id differs from morph JSON", () => {
    const byAlias = getGreekMorphTokensForChapter("the-gospel-of-luke", 6, null)
    expect(byAlias?.[1]?.length).toBeGreaterThan(5)
    const byUsfm = getGreekMorphTokensForChapter("x-wrong-slug", 6, "LUK")
    expect(byUsfm?.[1]?.length).toBeGreaterThan(5)
  })

  it("loads John 21", () => {
    const ch = getGreekMorphTokensForChapter("john", 21)
    expect(ch).not.toBeNull()
    expect(ch![1]?.length).toBeGreaterThan(5)
    expect(ch![25]?.length).toBeGreaterThan(0)
  })

  it("loads Revelation 22", () => {
    const ch = getGreekMorphTokensForChapter("revelation", 22)
    expect(ch).not.toBeNull()
    expect(ch![1]?.length).toBeGreaterThan(5)
    expect(ch![21]?.length).toBeGreaterThan(0)
  })

  it("returns null for non-NT or out-of-range chapters", () => {
    expect(getGreekMorphTokensForChapter("genesis", 1)).toBeNull()
    expect(getGreekMorphTokensForChapter("john", 22)).toBeNull()
  })
})
