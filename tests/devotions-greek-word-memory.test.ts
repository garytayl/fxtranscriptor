import { describe, expect, it } from "vitest"

import {
  buildWeakWordSet,
  getWordFamiliarityLabel,
  recordGreekWordMemoryTap,
} from "@/lib/devotions-greek-word-memory"

function makeStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
    removeItem: (key: string) => {
      map.delete(key)
    },
    clear: () => {
      map.clear()
    },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    get length() {
      return map.size
    },
  }
}

function withWindow<T>(fn: () => T): T {
  const originalWindow = (globalThis as { window?: unknown }).window
  ;(globalThis as { window?: unknown }).window = { localStorage: makeStorage() }
  try {
    return fn()
  } finally {
    ;(globalThis as { window?: unknown }).window = originalWindow
  }
}

describe("devotions greek word memory", () => {
  it("tracks familiarity progression from new to learned", () =>
    withWindow(() => {
      const first = recordGreekWordMemoryTap("λέγω|V-PAI-1S", false)
      expect(first.entry.familiarity).toBe("new")
      expect(first.previouslySeen).toBe(false)

      const second = recordGreekWordMemoryTap("λέγω|V-PAI-1S", true)
      expect(second.entry.familiarity).toBe("seen")
      expect(second.previouslySeen).toBe(true)

      recordGreekWordMemoryTap("λέγω|V-PAI-1S", true)
      const fourth = recordGreekWordMemoryTap("λέγω|V-PAI-1S", true)
      expect(fourth.entry.familiarity).toBe("learned")
    }))

  it("collects weak-word set from accumulated misses", () =>
    withWindow(() => {
      recordGreekWordMemoryTap("ὁ|RA-NSM", false)
      const one = recordGreekWordMemoryTap("ὁ|RA-NSM", false)
      const two = recordGreekWordMemoryTap("δὲ|X-", false)
      const weak = buildWeakWordSet(two.memory)
      expect(weak.has("ὁ|RA-NSM")).toBe(true)
      expect(weak.has("δὲ|X-")).toBe(false)
      expect(one.entry.weakScore).toBeGreaterThan(0)
    }))

  it("returns labels for familiarity states", () => {
    expect(getWordFamiliarityLabel("new")).toBe("New")
    expect(getWordFamiliarityLabel("seen")).toBe("Seen")
    expect(getWordFamiliarityLabel("learned")).toBe("Learned")
  })
})
