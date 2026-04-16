import { describe, expect, it } from "vitest"

import { buildStudyCoachProgressDigestFromState } from "@/lib/greek-study-coach-context"
import type { GreekProgressSnapshot, GreekStudyProgress } from "@/lib/devotions-greek-progress"
import type { GreekWordMemoryRow } from "@/lib/devotions-greek-word-memory"

function snap(over: Partial<GreekProgressSnapshot> = {}): GreekProgressSnapshot {
  return {
    level: 2,
    totalXp: 100,
    currentLevelXp: 40,
    nextLevelXp: 80,
    levelProgressPct: 50,
    streak: 3,
    todayXp: 30,
    dailyGoalXp: 120,
    dailyGoalReached: false,
    sessionsToday: 1,
    versesToday: 2,
    wordsToday: 4,
    coachToday: 0,
    uniqueWordForms: 5,
    ...over,
  }
}

describe("buildStudyCoachProgressDigestFromState", () => {
  it("includes level, streak, and milestone language", () => {
    const progress: GreekStudyProgress = {
      lastActiveAt: "",
      totalXp: 100,
      dailyGoalXp: 120,
      daysActive: ["2026-04-13"],
      dailyXpByDate: { "2026-04-13": 30 },
      sessionKeysByDate: {},
      verseKeysByDate: {},
      wordKeysByDate: {},
      coachKeysByDate: {},
      uniqueWordForms: ["a", "b", "c", "d", "e"],
    }
    const rows: GreekWordMemoryRow[] = []
    const digest = buildStudyCoachProgressDigestFromState(progress, snap(), rows, {
      pilotVerseTotal: 50,
      questVersesCompleted: 0,
    })
    expect(digest).toContain("Level 2")
    expect(digest).toContain("Streak 3")
    expect(digest).toContain("Pilot catalog")
  })

  it("lists weak forms when present", () => {
    const progress: GreekStudyProgress = {
      lastActiveAt: "",
      totalXp: 200,
      dailyGoalXp: 120,
      daysActive: [],
      dailyXpByDate: {},
      sessionKeysByDate: {},
      verseKeysByDate: {},
      wordKeysByDate: {},
      coachKeysByDate: {},
      uniqueWordForms: Array.from({ length: 12 }, (_, i) => `w${i}`),
    }
    const rows: GreekWordMemoryRow[] = [
      {
        formKey: "λόγος|----NSM-",
        lemma: "λόγος",
        parse: "----NSM-",
        taps: 5,
        correct: 2,
        weakScore: 8,
        familiarity: "seen",
        lastSeenAt: "2026-04-13T12:00:00.000Z",
      },
    ]
    const digest = buildStudyCoachProgressDigestFromState(progress, snap({ uniqueWordForms: 12 }), rows, {
      pilotVerseTotal: 100,
      questVersesCompleted: 3,
    })
    expect(digest).toContain("λόγος")
    expect(digest).toContain("weak 8")
  })
})
