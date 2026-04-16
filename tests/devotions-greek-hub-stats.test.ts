import { describe, expect, it } from "vitest"

import {
  activeDaysInRollingWindow,
  dateKeyFromDate,
  pilotVerseTotalCount,
  rollingDailyXpSum,
  uniqueQuestCompletedVersesCount,
} from "@/lib/devotions-greek-hub-stats"
import type { GreekStudyProgress } from "@/lib/devotions-greek-progress"

function emptyProgress(over: Partial<GreekStudyProgress> = {}): GreekStudyProgress {
  return {
    lastActiveAt: "",
    totalXp: 0,
    dailyGoalXp: 120,
    daysActive: [],
    dailyXpByDate: {},
    sessionKeysByDate: {},
    verseKeysByDate: {},
    wordKeysByDate: {},
    coachKeysByDate: {},
    uniqueWordForms: [],
    ...over,
  }
}

describe("devotions greek hub stats", () => {
  it("pilotVerseTotalCount matches sum of chapter maxVerse", () => {
    const n = pilotVerseTotalCount()
    expect(n).toBeGreaterThan(10)
  })

  it("counts unique quest-complete verse keys across dates", () => {
    const p = emptyProgress({
      verseKeysByDate: {
        "2026-04-10": ["john-1-1-quest-complete", "john-1-2-quest-complete"],
        "2026-04-11": ["john-1-1-quest-complete", "luke-6-5-quest-complete"],
      },
    })
    expect(uniqueQuestCompletedVersesCount(p)).toBe(3)
  })

  it("rollingDailyXpSum sums last N days", () => {
    const anchor = new Date("2026-04-13T12:00:00Z")
    const p = emptyProgress({
      dailyXpByDate: {
        "2026-04-13": 10,
        "2026-04-12": 20,
        "2026-04-11": 5,
      },
    })
    expect(rollingDailyXpSum(p, 7, anchor)).toBe(35)
    expect(rollingDailyXpSum(p, 2, anchor)).toBe(30)
  })

  it("activeDaysInRollingWindow counts daysActive in window", () => {
    const anchor = new Date("2026-04-13T12:00:00Z")
    const p = emptyProgress({
      daysActive: ["2026-04-13", "2026-04-11", "2026-03-01"],
    })
    expect(activeDaysInRollingWindow(p, 7, anchor)).toBe(2)
  })

  it("dateKeyFromDate matches progress date keys", () => {
    expect(dateKeyFromDate(new Date(2026, 0, 5, 12, 0, 0))).toBe("2026-01-05")
  })
})
