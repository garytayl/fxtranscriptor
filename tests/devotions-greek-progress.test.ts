import { describe, expect, it } from "vitest"

import {
  getGreekProgressSnapshot,
  recordGreekStudyEvent,
  type GreekStudyProgress,
} from "@/lib/devotions-greek-progress"

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

function todayAndYesterday(): { today: string; yesterday: string } {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  const prev = new Date(now)
  prev.setDate(prev.getDate() - 1)
  const yesterday = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`
  return { today, yesterday }
}

describe("devotions greek progress", () => {
  it("deduplicates repeated same-day events", () =>
    withWindow(() => {
      const first = recordGreekStudyEvent({ kind: "session", key: "daily-open", xp: 14 })
      const second = recordGreekStudyEvent({ kind: "session", key: "daily-open", xp: 14 })
      const third = recordGreekStudyEvent({ kind: "verse", key: "luke-6-10", xp: 8 })

      expect(first.awardedXp).toBe(14)
      expect(second.awardedXp).toBe(0)
      expect(third.awardedXp).toBe(8)
      expect(third.progress.totalXp).toBe(22)
    }))

  it("tracks word form variety and coach events", () =>
    withWindow(() => {
      recordGreekStudyEvent({
        kind: "word",
        key: "luke-6-10-11",
        xp: 12,
        wordFormKey: "ὁ|----NSM-",
      })
      recordGreekStudyEvent({
        kind: "word",
        key: "luke-6-10-12",
        xp: 12,
        wordFormKey: "δέ|--------",
      })
      const coach = recordGreekStudyEvent({
        kind: "coach",
        key: "luke-6-10-11|why article",
        xp: 20,
      })
      const snap = getGreekProgressSnapshot(coach.progress)
      expect(snap.wordsToday).toBe(2)
      expect(snap.coachToday).toBe(1)
      expect(snap.uniqueWordForms).toBe(2)
    }))

  it("computes level and streak from stored progress", () => {
    const { today, yesterday } = todayAndYesterday()
    const progress: GreekStudyProgress = {
      lastActiveAt: new Date().toISOString(),
      totalXp: 350,
      dailyGoalXp: 120,
      daysActive: [today, yesterday],
      dailyXpByDate: { [today]: 90 },
      sessionKeysByDate: {},
      verseKeysByDate: {},
      wordKeysByDate: {},
      coachKeysByDate: {},
      uniqueWordForms: ["a", "b", "c"],
    }
    const snap = getGreekProgressSnapshot(progress)
    expect(snap.level).toBeGreaterThan(1)
    expect(snap.streak).toBe(2)
    expect(snap.todayXp).toBe(90)
    expect(snap.dailyGoalReached).toBe(false)
  })
})
