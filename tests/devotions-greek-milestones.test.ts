import { describe, expect, it } from "vitest"

import { getNextMilestone } from "@/lib/devotions-greek-milestones"
import { getGreekProgressSnapshot, type GreekStudyProgress } from "@/lib/devotions-greek-progress"

describe("devotions greek milestones", () => {
  it("first milestone is word forms when bank is empty", () => {
    const progress: GreekStudyProgress = {
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
    }
    const snap = getGreekProgressSnapshot(progress)
    const m = getNextMilestone({
      progress,
      snapshot: snap,
      questVersesCompleted: 0,
      pilotVerseTotal: 100,
    })
    expect(m.id).toBe("first-word-form")
    expect(m.progressPct).toBe(0)
  })

  it("tracks progress toward 10 word forms", () => {
    const progress: GreekStudyProgress = {
      lastActiveAt: "",
      totalXp: 50,
      dailyGoalXp: 120,
      daysActive: [],
      dailyXpByDate: {},
      sessionKeysByDate: {},
      verseKeysByDate: {},
      wordKeysByDate: {},
      coachKeysByDate: {},
      uniqueWordForms: Array.from({ length: 7 }, (_, i) => `w${i}`),
    }
    const snap = getGreekProgressSnapshot(progress)
    const m = getNextMilestone({
      progress,
      snapshot: snap,
      questVersesCompleted: 0,
      pilotVerseTotal: 200,
    })
    expect(m.id).toBe("ten-word-forms")
    expect(m.progressPct).toBe(70)
  })

  it("asks for first quest verse when words >= 10 but no coverage", () => {
    const progress: GreekStudyProgress = {
      lastActiveAt: "",
      totalXp: 100,
      dailyGoalXp: 120,
      daysActive: [],
      dailyXpByDate: {},
      sessionKeysByDate: {},
      verseKeysByDate: {},
      wordKeysByDate: {},
      coachKeysByDate: {},
      uniqueWordForms: Array.from({ length: 12 }, (_, i) => `w${i}`),
    }
    const snap = getGreekProgressSnapshot(progress)
    const m = getNextMilestone({
      progress,
      snapshot: snap,
      questVersesCompleted: 0,
      pilotVerseTotal: 100,
    })
    expect(m.id).toBe("first-quest-verse")
  })

  it("pilot quarter milestone when under 25 percent", () => {
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
      uniqueWordForms: Array.from({ length: 15 }, (_, i) => `w${i}`),
    }
    const snap = getGreekProgressSnapshot(progress)
    const pilotVerseTotal = 100
    const completed = 10
    const m = getNextMilestone({
      progress,
      snapshot: snap,
      questVersesCompleted: completed,
      pilotVerseTotal,
    })
    expect(m.id).toBe("pilot-quarter")
    expect(m.progressPct).toBe(40)
  })
})
