/**
 * Reading plan state: section/book, last position, chapters per day.
 * Stored in localStorage; no sign-in.
 */

import { getSection } from "@/lib/devotions-sections"

const PLAN_STORAGE_KEY = "fx_devotions_v1_reading_plan"

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
}

const defaultPlan: ReadingPlanState | null = null

function safeParse(raw: string | null): ReadingPlanState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<ReadingPlanState>
    if (
      typeof parsed?.sectionId === "string" &&
      typeof parsed?.lastBookId === "string" &&
      typeof parsed?.lastChapter === "number"
    ) {
      const section = getSection(parsed.sectionId)
      if (!section || !section.bookIds.includes(parsed.lastBookId)) return null
      return {
        sectionId: parsed.sectionId,
        lastBookId: parsed.lastBookId,
        lastChapter: parsed.lastChapter,
        chaptersPerDay: typeof parsed.chaptersPerDay === "number" && parsed.chaptersPerDay >= 1 ? parsed.chaptersPerDay : 1,
        startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : undefined,
      }
    }
  } catch {
    // ignore
  }
  return null
}

export function getReadingPlan(): ReadingPlanState | null {
  if (typeof window === "undefined") return null
  return safeParse(window.localStorage.getItem(PLAN_STORAGE_KEY))
}

export function setReadingPlan(plan: ReadingPlanState): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan))
}

export function clearReadingPlan(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(PLAN_STORAGE_KEY)
}

/** Get the next chapter to read: (lastBookId, lastChapter + 1). Caller validates that chapter exists. */
export function getNextChapter(plan: ReadingPlanState): { bookId: string; chapterNumber: number } | null {
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

/** Advance plan after reading a chapter. Returns new state or null if plan is finished. */
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
    return { ...plan, lastBookId: bookId, lastChapter: chapterNumber }
  }
  const nextBookIndex = bookIndex + 1
  if (nextBookIndex >= section.bookIds.length) {
    return null
  }
  const nextBookId = section.bookIds[nextBookIndex]
  return { ...plan, lastBookId: nextBookId, lastChapter: 0 }
}

/** Build reference string for a book+chapter (e.g. "Matthew 3"). Name must be provided by caller. */
export function formatPlanReference(bookName: string, chapterNumber: number): string {
  return `${bookName} ${chapterNumber}`
}
