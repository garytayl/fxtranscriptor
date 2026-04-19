const GREEK_PROGRESS_KEY = "fx_devotions_greek_v1_progress"
const MAX_DAYS_TO_KEEP = 90
const MAX_UNIQUE_WORD_FORMS = 4000

export type GreekProgressEventKind = "session" | "verse" | "word" | "coach"

export type GreekProgressEvent = {
  kind: GreekProgressEventKind
  key: string
  xp: number
  wordFormKey?: string
}

export type GreekStudyProgress = {
  lastActiveAt: string
  totalXp: number
  dailyGoalXp: number
  daysActive: string[]
  dailyXpByDate: Record<string, number>
  sessionKeysByDate: Record<string, string[]>
  verseKeysByDate: Record<string, string[]>
  wordKeysByDate: Record<string, string[]>
  coachKeysByDate: Record<string, string[]>
  uniqueWordForms: string[]
}

export type GreekProgressSnapshot = {
  level: number
  totalXp: number
  currentLevelXp: number
  nextLevelXp: number
  levelProgressPct: number
  streak: number
  todayXp: number
  dailyGoalXp: number
  dailyGoalReached: boolean
  sessionsToday: number
  versesToday: number
  wordsToday: number
  coachToday: number
  uniqueWordForms: number
}

const defaultProgress: GreekStudyProgress = {
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

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
}

function toDateMap(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object") return {}
  const out: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = toStringArray(v)
  }
  return out
}

function toNumberMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v
  }
  return out
}

function safeParse(raw: string | null): GreekStudyProgress {
  if (!raw) return defaultProgress
  try {
    const parsed = JSON.parse(raw) as Partial<GreekStudyProgress>
    return {
      lastActiveAt: typeof parsed.lastActiveAt === "string" ? parsed.lastActiveAt : "",
      totalXp: typeof parsed.totalXp === "number" ? parsed.totalXp : 0,
      dailyGoalXp:
        typeof parsed.dailyGoalXp === "number" && parsed.dailyGoalXp >= 50 && parsed.dailyGoalXp <= 500
          ? parsed.dailyGoalXp
          : defaultProgress.dailyGoalXp,
      daysActive: toStringArray(parsed.daysActive).slice(0, 400),
      dailyXpByDate: toNumberMap(parsed.dailyXpByDate),
      sessionKeysByDate: toDateMap(parsed.sessionKeysByDate),
      verseKeysByDate: toDateMap(parsed.verseKeysByDate),
      wordKeysByDate: toDateMap(parsed.wordKeysByDate),
      coachKeysByDate: toDateMap(parsed.coachKeysByDate),
      uniqueWordForms: toStringArray(parsed.uniqueWordForms).slice(0, MAX_UNIQUE_WORD_FORMS),
    }
  } catch {
    return defaultProgress
  }
}

export const GREEK_PROGRESS_BROADCAST_CHANNEL = "fx-greek-progress"

/** Dispatched on `window` when new XP is recorded (client only). */
export const GREEK_XP_AWARD_EVENT = "fx-greek-xp-award"

export type GreekXpAwardDetail = {
  awardedXp: number
  leveledUp: boolean
  level: number
  previousLevel: number
  totalXp: number
  /** True when this award pushed today's XP from below the daily goal to at or above it. */
  dailyGoalJustMet: boolean
  /** Today's running XP total after this award. */
  todayXp: number
  /** Configured daily XP target. */
  dailyGoalXp: number
}

export type RecordGreekStudyResult = {
  progress: GreekStudyProgress
  awardedXp: number
  /** Set when `awardedXp > 0` (browser only). */
  awardDetail?: GreekXpAwardDetail
}

/** Subscribe to XP celebrations (same source as `recordGreekStudyEvent` dispatches). No-op on server. */
export function subscribeGreekXpAwards(handler: (detail: GreekXpAwardDetail) => void): () => void {
  if (typeof window === "undefined") return () => {}
  const listener = (e: Event) => {
    const ce = e as CustomEvent<GreekXpAwardDetail>
    if (ce.detail && ce.detail.awardedXp > 0) handler(ce.detail)
  }
  window.addEventListener(GREEK_XP_AWARD_EVENT, listener)
  return () => window.removeEventListener(GREEK_XP_AWARD_EVENT, listener)
}

let progressBroadcast: BroadcastChannel | null = null

function broadcastGreekProgressChanged() {
  if (typeof BroadcastChannel === "undefined") return
  try {
    if (!progressBroadcast) progressBroadcast = new BroadcastChannel(GREEK_PROGRESS_BROADCAST_CHANNEL)
    progressBroadcast.postMessage({ type: "greek-progress-updated" })
  } catch {
    /* ignore */
  }
}

function saveGreekStudyProgress(progress: GreekStudyProgress): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(GREEK_PROGRESS_KEY, JSON.stringify(progress))
  broadcastGreekProgressChanged()
}

function pruneDateMaps(progress: GreekStudyProgress): GreekStudyProgress {
  const keepDates = new Set(progress.daysActive.slice(0, MAX_DAYS_TO_KEEP))
  const pruneMap = (m: Record<string, string[]>): Record<string, string[]> => {
    const out: Record<string, string[]> = {}
    for (const [k, v] of Object.entries(m)) {
      if (keepDates.has(k)) out[k] = v
    }
    return out
  }
  const pruneNumberMap = (m: Record<string, number>): Record<string, number> => {
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(m)) {
      if (keepDates.has(k)) out[k] = v
    }
    return out
  }
  return {
    ...progress,
    dailyXpByDate: pruneNumberMap(progress.dailyXpByDate),
    sessionKeysByDate: pruneMap(progress.sessionKeysByDate),
    verseKeysByDate: pruneMap(progress.verseKeysByDate),
    wordKeysByDate: pruneMap(progress.wordKeysByDate),
    coachKeysByDate: pruneMap(progress.coachKeysByDate),
  }
}

function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0
  let total = 0
  for (let l = 1; l < level; l++) {
    total += 80 + (l - 1) * 35
  }
  return total
}

function levelFromXp(totalXp: number): number {
  let level = 1
  while (level < 200 && totalXp >= xpRequiredForLevel(level + 1)) {
    level++
  }
  return level
}

function currentStreak(daysActive: string[]): number {
  if (daysActive.length === 0) return 0
  const today = todayStr()
  if (daysActive[0] !== today) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const y = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`
    if (daysActive[0] !== y) return 0
  }
  let streak = 0
  let expect = today
  for (const d of daysActive) {
    if (d !== expect) break
    streak++
    const prev = new Date(`${expect}T12:00:00`)
    prev.setDate(prev.getDate() - 1)
    expect = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`
  }
  return streak
}

export function getGreekStudyProgress(): GreekStudyProgress {
  if (typeof window === "undefined") return defaultProgress
  return safeParse(window.localStorage.getItem(GREEK_PROGRESS_KEY))
}

export function recordGreekStudyEvent(event: GreekProgressEvent): RecordGreekStudyResult {
  const progress = getGreekStudyProgress()
  const levelBefore = levelFromXp(progress.totalXp)
  const today = todayStr()
  const todayXpBeforeAward = progress.dailyXpByDate[today] ?? 0
  const dailyGoalXp = progress.dailyGoalXp
  const dayAlreadyTracked = progress.daysActive[0] === today
  const daysActive = dayAlreadyTracked
    ? progress.daysActive
    : [today, ...progress.daysActive.filter((d) => d !== today)].slice(0, 400)

  const selectMap = () => {
    if (event.kind === "session") return progress.sessionKeysByDate
    if (event.kind === "verse") return progress.verseKeysByDate
    if (event.kind === "word") return progress.wordKeysByDate
    return progress.coachKeysByDate
  }

  const activeMap = selectMap()
  const todayKeys = new Set(activeMap[today] ?? [])
  const alreadyRecorded = todayKeys.has(event.key)
  const awardedXp = alreadyRecorded ? 0 : Math.max(0, Math.floor(event.xp))
  if (!alreadyRecorded) {
    todayKeys.add(event.key)
  }

  const updated: GreekStudyProgress = {
    ...progress,
    lastActiveAt: new Date().toISOString(),
    totalXp: progress.totalXp + awardedXp,
    daysActive,
    dailyXpByDate: {
      ...progress.dailyXpByDate,
      [today]: (progress.dailyXpByDate[today] ?? 0) + awardedXp,
    },
    sessionKeysByDate:
      event.kind === "session"
        ? { ...progress.sessionKeysByDate, [today]: Array.from(todayKeys) }
        : progress.sessionKeysByDate,
    verseKeysByDate:
      event.kind === "verse"
        ? { ...progress.verseKeysByDate, [today]: Array.from(todayKeys) }
        : progress.verseKeysByDate,
    wordKeysByDate:
      event.kind === "word"
        ? { ...progress.wordKeysByDate, [today]: Array.from(todayKeys) }
        : progress.wordKeysByDate,
    coachKeysByDate:
      event.kind === "coach"
        ? { ...progress.coachKeysByDate, [today]: Array.from(todayKeys) }
        : progress.coachKeysByDate,
    uniqueWordForms: progress.uniqueWordForms,
  }

  if (event.wordFormKey && !updated.uniqueWordForms.includes(event.wordFormKey)) {
    updated.uniqueWordForms = [event.wordFormKey, ...updated.uniqueWordForms].slice(0, MAX_UNIQUE_WORD_FORMS)
  }

  const pruned = pruneDateMaps(updated)
  saveGreekStudyProgress(pruned)

  const levelAfter = levelFromXp(pruned.totalXp)
  const leveledUp = levelAfter > levelBefore
  const todayXpAfterAward = pruned.dailyXpByDate[today] ?? 0
  const dailyGoalJustMet =
    awardedXp > 0 && todayXpBeforeAward < dailyGoalXp && todayXpAfterAward >= pruned.dailyGoalXp
  let awardDetail: GreekXpAwardDetail | undefined
  if (typeof window !== "undefined" && awardedXp > 0) {
    awardDetail = {
      awardedXp,
      leveledUp,
      level: levelAfter,
      previousLevel: levelBefore,
      totalXp: pruned.totalXp,
      dailyGoalJustMet,
      todayXp: todayXpAfterAward,
      dailyGoalXp: pruned.dailyGoalXp,
    }
    if (typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent<GreekXpAwardDetail>(GREEK_XP_AWARD_EVENT, { detail: awardDetail }))
    }
  }

  return { progress: pruned, awardedXp, awardDetail }
}

export function getGreekProgressSnapshot(progress: GreekStudyProgress): GreekProgressSnapshot {
  const today = todayStr()
  const level = levelFromXp(progress.totalXp)
  const startXp = xpRequiredForLevel(level)
  const nextXp = xpRequiredForLevel(level + 1)
  const inLevel = progress.totalXp - startXp
  const toNext = Math.max(1, nextXp - startXp)
  const levelProgressPct = Math.max(0, Math.min(100, (inLevel / toNext) * 100))
  const todayXp = progress.dailyXpByDate[today] ?? 0

  return {
    level,
    totalXp: progress.totalXp,
    currentLevelXp: inLevel,
    nextLevelXp: toNext,
    levelProgressPct,
    streak: currentStreak(progress.daysActive),
    todayXp,
    dailyGoalXp: progress.dailyGoalXp,
    dailyGoalReached: todayXp >= progress.dailyGoalXp,
    sessionsToday: progress.sessionKeysByDate[today]?.length ?? 0,
    versesToday: progress.verseKeysByDate[today]?.length ?? 0,
    wordsToday: progress.wordKeysByDate[today]?.length ?? 0,
    coachToday: progress.coachKeysByDate[today]?.length ?? 0,
    uniqueWordForms: progress.uniqueWordForms.length,
  }
}
