import { describe, expect, it } from "vitest"

import { getGreekMorphTokensForChapter } from "@/lib/bible/morph-lookup"

describe("morph pilot chapters", () => {
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

  it("returns null for non-pilot chapters", () => {
    expect(getGreekMorphTokensForChapter("luke", 5)).toBeNull()
    expect(getGreekMorphTokensForChapter("john", 2)).toBeNull()
  })
})
