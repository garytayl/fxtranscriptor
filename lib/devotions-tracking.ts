/**
 * Devotions tracking — sessions, passages read, streak.
 * Only recorded when settings.showTracking is true. Stored in localStorage.
 */

const TRACKING_KEY = "fx_devotions_v1_tracking"

export type TrackingDay = {
  date: string // YYYY-MM-DD
  sessions: number
  passageRef?: string
}

export type DevotionsTracking = {
  lastSessionAt: string // ISO
  totalSessions: number
  totalPassagesRead: number
  /** YYYY-MM-DD, most recent first, for streak calc */
  daysWithSessions: string[]
}

const defaultTracking: DevotionsTracking = {
  lastSessionAt: "",
  totalSessions: 0,
  totalPassagesRead: 0,
  daysWithSessions: [],
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function safeParse(raw: string | null): DevotionsTracking {
  if (!raw) return defaultTracking
  try {
    const parsed = JSON.parse(raw) as Partial<DevotionsTracking>
    return {
      lastSessionAt: typeof parsed.lastSessionAt === "string" ? parsed.lastSessionAt : defaultTracking.lastSessionAt,
      totalSessions: typeof parsed.totalSessions === "number" ? parsed.totalSessions : defaultTracking.totalSessions,
      totalPassagesRead: typeof parsed.totalPassagesRead === "number" ? parsed.totalPassagesRead : defaultTracking.totalPassagesRead,
      daysWithSessions: Array.isArray(parsed.daysWithSessions) ? parsed.daysWithSessions : defaultTracking.daysWithSessions,
    }
  } catch {
    return defaultTracking
  }
}

export function getDevotionsTracking(): DevotionsTracking {
  if (typeof window === "undefined") return defaultTracking
  return safeParse(window.localStorage.getItem(TRACKING_KEY))
}

function saveTracking(t: DevotionsTracking): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(TRACKING_KEY, JSON.stringify(t))
}

/** Call when user enters the reading view (session start) or loads a passage. Only updates if showTracking is true. */
export function recordDevotionSession(passageRef: string, showTracking: boolean): void {
  if (!showTracking) return
  const t = getDevotionsTracking()
  const now = new Date().toISOString()
  const today = todayStr()
  const days = t.daysWithSessions
  const alreadyToday = days[0] === today
  const newDays = alreadyToday ? days : [today, ...days.filter((d) => d !== today)].slice(0, 400)
  saveTracking({
    lastSessionAt: now,
    totalSessions: t.totalSessions + 1,
    totalPassagesRead: t.totalPassagesRead + 1,
    daysWithSessions: newDays,
  })
}

/** Sessions this calendar week (Sun–Sat). */
export function sessionsThisWeek(tracking: DevotionsTracking): number {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - dayOfWeek)
  startOfWeek.setHours(0, 0, 0, 0)
  const startStr = startOfWeek.getFullYear() + "-" +
    String(startOfWeek.getMonth() + 1).padStart(2, "0") + "-" +
    String(startOfWeek.getDate()).padStart(2, "0")
  return tracking.daysWithSessions.filter((d) => d >= startStr).length
}

/** Current streak: consecutive days (including today) with at least one session. */
export function currentStreak(tracking: DevotionsTracking): number {
  const days = tracking.daysWithSessions
  if (days.length === 0) return 0
  const today = todayStr()
  if (days[0] !== today) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.getFullYear() + "-" +
      String(yesterday.getMonth() + 1).padStart(2, "0") + "-" +
      String(yesterday.getDate()).padStart(2, "0")
    if (days[0] !== yesterdayStr) return 0
  }
  let streak = 0
  let expect = today
  for (const d of days) {
    if (d !== expect) break
    streak++
    const prev = new Date(expect + "T12:00:00")
    prev.setDate(prev.getDate() - 1)
    expect = prev.getFullYear() + "-" +
      String(prev.getMonth() + 1).padStart(2, "0") + "-" +
      String(prev.getDate()).padStart(2, "0")
  }
  return streak
}
