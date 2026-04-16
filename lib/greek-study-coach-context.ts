import {
  activeDaysInRollingWindow,
  pilotVerseTotalCount,
  rollingDailyXpSum,
  uniqueQuestCompletedVersesCount,
} from "@/lib/devotions-greek-hub-stats"
import { getNextMilestone } from "@/lib/devotions-greek-milestones"
import {
  getGreekProgressSnapshot,
  getGreekStudyProgress,
  type GreekProgressSnapshot,
  type GreekStudyProgress,
} from "@/lib/devotions-greek-progress"
import {
  filterAndSortWordMemoryRows,
  getGreekWordMemory,
  listGreekWordMemoryRows,
  type GreekWordMemoryRow,
} from "@/lib/devotions-greek-word-memory"

export type StudyCoachProgressOpts = {
  pilotVerseTotal: number
  questVersesCompleted: number
}

/**
 * Plain-text digest for the study coach API (built from the same local data as the hub).
 * Safe to send to the model; contains no secrets.
 */
export function buildStudyCoachProgressDigestFromState(
  progress: GreekStudyProgress,
  snapshot: GreekProgressSnapshot,
  rows: GreekWordMemoryRow[],
  opts: StudyCoachProgressOpts,
): string {
  const weakRows = filterAndSortWordMemoryRows(rows, "weak", "weak").slice(0, 18)
  const milestone = getNextMilestone({
    progress,
    snapshot,
    questVersesCompleted: opts.questVersesCompleted,
    pilotVerseTotal: Math.max(1, opts.pilotVerseTotal),
  })
  const weeklyXp = rollingDailyXpSum(progress, 7)
  const active7 = activeDaysInRollingWindow(progress, 7)

  const lines: string[] = []
  lines.push(
    `Level ${snapshot.level} · Total XP ${snapshot.totalXp} · Streak ${snapshot.streak} day(s) · Unique word forms in bank: ${snapshot.uniqueWordForms}`,
  )
  lines.push(
    `Today: ${snapshot.todayXp}/${snapshot.dailyGoalXp} XP (daily goal ${snapshot.dailyGoalReached ? "met" : "not met yet"})`,
  )
  lines.push(`Sessions / verses / words / coach events today: ${snapshot.sessionsToday} / ${snapshot.versesToday} / ${snapshot.wordsToday} / ${snapshot.coachToday}`)
  lines.push(`Next focus milestone: "${milestone.title}" (${milestone.progressPct}% toward it) — ${milestone.detail}`)
  lines.push(`Last 7 days XP sum: ${weeklyXp} · Active days in last 7: ${active7}`)
  lines.push(`Pilot catalog: ${opts.questVersesCompleted} verses fully completed in Verse Quest (of ${opts.pilotVerseTotal} total pilot verses)`)

  if (weakRows.length > 0) {
    lines.push(`Forms weighted for review (lemma, parse snippet, familiarity, weak score, quiz correct/taps):`)
    for (const r of weakRows) {
      const parseShort = r.parse.length > 14 ? `${r.parse.slice(0, 14)}…` : r.parse
      lines.push(`- ${r.lemma} | ${parseShort} | ${r.familiarity} | weak ${r.weakScore} | ${r.correct}/${r.taps}`)
    }
  } else {
    lines.push(`No "weak" queue yet — keep drilling in Verse Quest to populate review targets.`)
  }

  return lines.join("\n")
}

/** Browser-only: reads localStorage-backed progress and word memory. */
export function buildStudyCoachProgressDigest(): string {
  if (typeof window === "undefined") return ""
  const progress = getGreekStudyProgress()
  const snapshot = getGreekProgressSnapshot(progress)
  const rows = listGreekWordMemoryRows(getGreekWordMemory())
  return buildStudyCoachProgressDigestFromState(progress, snapshot, rows, {
    pilotVerseTotal: pilotVerseTotalCount(),
    questVersesCompleted: uniqueQuestCompletedVersesCount(progress),
  })
}
