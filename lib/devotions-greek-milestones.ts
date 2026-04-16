import type { GreekProgressSnapshot, GreekStudyProgress } from "@/lib/devotions-greek-progress"

export type NextMilestone = {
  id: string
  title: string
  /** 0–100 progress toward this milestone */
  progressPct: number
  /** Short hint for UI */
  detail: string
}

type Ctx = {
  progress: GreekStudyProgress
  snapshot: GreekProgressSnapshot
  questVersesCompleted: number
  pilotVerseTotal: number
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

/**
 * Ordered milestones; first incomplete wins (with partial progress).
 * Keep IDs stable for tests and analytics.
 */
function evaluate(ctx: Ctx): NextMilestone {
  const { snapshot, questVersesCompleted, pilotVerseTotal } = ctx
  const words = snapshot.uniqueWordForms

  if (words < 1) {
    return {
      id: "first-word-form",
      title: "First word form",
      progressPct: 0,
      detail: "Practice a word in Verse Quest to start your word bank.",
    }
  }

  if (words < 10) {
    return {
      id: "ten-word-forms",
      title: "10 word forms",
      progressPct: clampPct((words / 10) * 100),
      detail: `${words}/10 unique forms in your bank.`,
    }
  }

  if (questVersesCompleted < 1) {
    return {
      id: "first-quest-verse",
      title: "First verse complete",
      progressPct: 0,
      detail: "Finish a level in Verse Quest on any pilot verse.",
    }
  }

  const pilotPct = pilotVerseTotal > 0 ? (questVersesCompleted / pilotVerseTotal) * 100 : 0
  if (pilotPct < 25) {
    return {
      id: "pilot-quarter",
      title: "25% of pilot verses",
      progressPct: clampPct((pilotPct / 25) * 100),
      detail: `${questVersesCompleted}/${pilotVerseTotal} pilot verses completed in quest.`,
    }
  }

  if (pilotPct < 50) {
    return {
      id: "pilot-half",
      title: "Half the pilot catalog",
      progressPct: clampPct(((pilotPct - 25) / 25) * 100),
      detail: `${questVersesCompleted}/${pilotVerseTotal} pilot verses — keep going.`,
    }
  }

  if (snapshot.level < 10) {
    const target = 10
    const pct = ((snapshot.level - 1) / (target - 1)) * 100
    return {
      id: "level-ten",
      title: "Reach level 10",
      progressPct: clampPct(pct),
      detail: `You are level ${snapshot.level}. Earn XP in quest, coach, and drills.`,
    }
  }

  if (snapshot.streak < 14) {
    return {
      id: "streak-fourteen",
      title: "Two-week streak",
      progressPct: clampPct((snapshot.streak / 14) * 100),
      detail: `${snapshot.streak} day streak — study most days for two weeks.`,
    }
  }

  return {
    id: "keep-going",
    title: "Keep sharpening Greek",
    progressPct: 100,
    detail: "You have hit the main milestones. Stay curious in reader and quest.",
  }
}

export function getNextMilestone(ctx: Ctx): NextMilestone {
  return evaluate(ctx)
}
