/**
 * Reading plans state: multiple section plans + active plan pointer.
 * Stored in localStorage; no sign-in.
 */

import { getSection } from "@/lib/devotions-sections"

const PLAN_STORAGE_KEY = "fx_devotions_v2_reading_plans"
const LEGACY_PLAN_STORAGE_KEY = "fx_devotions_v1_reading_plan"

export type ReadingPlanState = {
  sectionId: string
  /** Last book id the user was reading (e.g. MAT). */
  lastBookId: string
  /** Last chapter number completed; "next" is lastChapter + 1. */
  lastChapter: number
  /** How many chapters to show/advance per session (default 1). */
  chaptersPerDay: number
  /** When the plan was started (ISO). */
  startedAt?: string
  /** When this plan was completed (ISO). */
  completedAt?: string
}

type ReadingPlansStore = {
  version: 2
  activeSectionId: string | null
  plans: ReadingPlanState[]
}

const defaultStore: ReadingPlansStore = {
  version: 2,
  activeSectionId: null,
  plans: [],
}

function normalizePlan(input: Partial<ReadingPlanState>): ReadingPlanState | null {
  if (
    typeof input.sectionId !== "string" ||
    typeof input.lastBookId !== "string" ||
    typeof input.lastChapter !== "number"
  ) {
    return null
  }
  const section = getSection(input.sectionId)
  if (!section || !section.bookIds.includes(input.lastBookId)) return null
  return {
    sectionId: input.sectionId,
    lastBookId: input.lastBookId,
    lastChapter: Math.max(0, Math.floor(input.lastChapter)),
    chaptersPerDay:
      typeof input.chaptersPerDay === "number" && input.chaptersPerDay >= 1
        ? Math.max(1, Math.floor(input.chaptersPerDay))
        : 1,
    startedAt: typeof input.startedAt === "string" ? input.startedAt : undefined,
    completedAt: typeof input.completedAt === "string" ? input.completedAt : undefined,
  }
}

function parseV2Store(raw: string | null): ReadingPlansStore | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<ReadingPlansStore>
    if (parsed?.version !== 2 || !Array.isArray(parsed.plans)) return null
    const deduped = new Map<string, ReadingPlanState>()
    for (const maybePlan of parsed.plans) {
      const plan = normalizePlan(maybePlan)
      if (!plan) continue
      deduped.set(plan.sectionId.toLowerCase(), plan)
    }
    const plans = Array.from(deduped.values())
    const activeSectionId =
      typeof parsed.activeSectionId === "string" &&
      plans.some((p) => p.sectionId.toLowerCase() === parsed.activeSectionId?.toLowerCase())
        ? parsed.activeSectionId
        : (plans[0]?.sectionId ?? null)
    return {
      version: 2,
      activeSectionId,
      plans,
    }
  } catch {
    return null
  }
}

function parseLegacyPlan(raw: string | null): ReadingPlanState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<ReadingPlanState>
    return normalizePlan(parsed)
  } catch {
    return null
  }
}

function saveStore(store: ReadingPlansStore): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(store))
}

function getStore(): ReadingPlansStore {
  if (typeof window === "undefined") return defaultStore
  const current = parseV2Store(window.localStorage.getItem(PLAN_STORAGE_KEY))
  if (current) return current
  const legacy = parseLegacyPlan(window.localStorage.getItem(LEGACY_PLAN_STORAGE_KEY))
  if (!legacy) return defaultStore
  const migrated: ReadingPlansStore = {
    version: 2,
    activeSectionId: legacy.sectionId,
    plans: [legacy],
  }
  saveStore(migrated)
  window.localStorage.removeItem(LEGACY_PLAN_STORAGE_KEY)
  return migrated
}

export function listReadingPlans(): ReadingPlanState[] {
  return getStore().plans
}

/**
 * Returns a section-specific plan if sectionId is provided.
 * Otherwise returns the active plan (or the first plan if no active pointer exists).
 */
export function getReadingPlan(sectionId?: string): ReadingPlanState | null {
  const store = getStore()
  if (!sectionId) {
    if (!store.activeSectionId) return store.plans[0] ?? null
    return (
      store.plans.find((p) => p.sectionId.toLowerCase() === store.activeSectionId?.toLowerCase()) ??
      store.plans[0] ??
      null
    )
  }
  return store.plans.find((p) => p.sectionId.toLowerCase() === sectionId.toLowerCase()) ?? null
}

export function getActiveReadingPlan(): ReadingPlanState | null {
  return getReadingPlan()
}

export function setReadingPlan(plan: ReadingPlanState, options?: { setActive?: boolean }): void {
  if (typeof window === "undefined") return
  const normalized = normalizePlan(plan)
  if (!normalized) return
  const store = getStore()
  const plans = [...store.plans]
  const idx = plans.findIndex((p) => p.sectionId.toLowerCase() === normalized.sectionId.toLowerCase())
  if (idx >= 0) plans[idx] = normalized
  else plans.push(normalized)
  const shouldSetActive = options?.setActive !== false
  const next: ReadingPlansStore = {
    version: 2,
    activeSectionId: shouldSetActive
      ? normalized.sectionId
      : (store.activeSectionId ?? normalized.sectionId),
    plans,
  }
  saveStore(next)
}

export function setActiveReadingPlan(sectionId: string): void {
  if (typeof window === "undefined") return
  const store = getStore()
  if (!store.plans.some((p) => p.sectionId.toLowerCase() === sectionId.toLowerCase())) return
  saveStore({ ...store, activeSectionId: sectionId })
}

export function removeReadingPlan(sectionId: string): void {
  if (typeof window === "undefined") return
  const store = getStore()
  const plans = store.plans.filter((p) => p.sectionId.toLowerCase() !== sectionId.toLowerCase())
  const nextActive =
    store.activeSectionId?.toLowerCase() === sectionId.toLowerCase()
      ? (plans[0]?.sectionId ?? null)
      : store.activeSectionId
  saveStore({ version: 2, activeSectionId: nextActive, plans })
}

/** Clears all reading plans. */
export function clearReadingPlan(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(PLAN_STORAGE_KEY)
  window.localStorage.removeItem(LEGACY_PLAN_STORAGE_KEY)
}

export function isReadingPlanComplete(plan: ReadingPlanState): boolean {
  return typeof plan.completedAt === "string" && plan.completedAt.length > 0
}

/** Get the next chapter to read: (lastBookId, lastChapter + 1). Caller validates that chapter exists. */
export function getNextChapter(plan: ReadingPlanState): { bookId: string; chapterNumber: number } | null {
  if (isReadingPlanComplete(plan)) return null
  const section = getSection(plan.sectionId)
  if (!section) return null
  if (!section.bookIds.includes(plan.lastBookId)) return null
  return { bookId: plan.lastBookId, chapterNumber: plan.lastChapter + 1 }
}

/** Get the first chapter of the plan (to start). */
export function getPlanStart(plan: ReadingPlanState): { bookId: string; chapterNumber: number } | null {
  const section = getSection(plan.sectionId)
  if (!section || section.bookIds.length === 0) return null
  return { bookId: section.bookIds[0], chapterNumber: 1 }
}

/** Advance plan after reading a chapter. Returns updated state; terminal step marks completedAt. */
export function advanceReadingPlan(
  plan: ReadingPlanState,
  bookId: string,
  chapterNumber: number,
  maxChapterInBook: number
): ReadingPlanState | null {
  const section = getSection(plan.sectionId)
  if (!section) return null
  const bookIndex = section.bookIds.indexOf(bookId)
  if (bookIndex < 0) return null
  if (chapterNumber < maxChapterInBook) {
    return {
      ...plan,
      lastBookId: bookId,
      lastChapter: chapterNumber,
      completedAt: undefined,
    }
  }
  const nextBookIndex = bookIndex + 1
  if (nextBookIndex >= section.bookIds.length) {
    return {
      ...plan,
      lastBookId: bookId,
      lastChapter: chapterNumber,
      completedAt: new Date().toISOString(),
    }
  }
  const nextBookId = section.bookIds[nextBookIndex]
  return {
    ...plan,
    lastBookId: nextBookId,
    lastChapter: 0,
    completedAt: undefined,
  }
}

/** Build reference string for a book+chapter (e.g. "Matthew 3"). Name must be provided by caller. */
export function formatPlanReference(bookName: string, chapterNumber: number): string {
  return `${bookName} ${chapterNumber}`
}
