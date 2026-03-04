import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  advanceReadingPlan,
  getActiveReadingPlan,
  getNextChapter,
  getReadingPlan,
  isReadingPlanComplete,
  listReadingPlans,
  setActiveReadingPlan,
  setReadingPlan,
  type ReadingPlanState,
} from "../lib/devotions-plan"
import { getPredefinedSections } from "../lib/devotions-sections"

class LocalStorageMock {
  private store = new Map<string, string>()

  get length(): number {
    return this.store.size
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) ?? null) : null
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }
}

describe("devotions reading plans", () => {
  beforeEach(() => {
    const g = globalThis as typeof globalThis & { window?: { localStorage: LocalStorageMock } }
    g.window = { localStorage: new LocalStorageMock() }
  })

  afterEach(() => {
    const g = globalThis as typeof globalThis & { window?: { localStorage: LocalStorageMock } }
    delete g.window
  })

  it("defines psalms as a dedicated plan and wisdom as the other four books", () => {
    const sections = getPredefinedSections()
    const psalms = sections.find((s) => s.id === "psalms")
    const wisdom = sections.find((s) => s.id === "wisdom")
    expect(psalms?.bookIds).toEqual(["PSA"])
    expect(wisdom?.bookIds).toEqual(["JOB", "PRO", "ECC", "SNG"])
  })

  it("migrates legacy single-plan storage into multi-plan storage", () => {
    const legacyPlan = {
      sectionId: "psalms",
      lastBookId: "PSA",
      lastChapter: 10,
      chaptersPerDay: 1,
    }
    window.localStorage.setItem("fx_devotions_v1_reading_plan", JSON.stringify(legacyPlan))
    const plans = listReadingPlans()
    expect(plans).toHaveLength(1)
    expect(plans[0]?.sectionId).toBe("psalms")
    expect(window.localStorage.getItem("fx_devotions_v2_reading_plans")).toBeTruthy()
  })

  it("tracks multiple plans and active selection", () => {
    const psalmsPlan: ReadingPlanState = {
      sectionId: "psalms",
      lastBookId: "PSA",
      lastChapter: 15,
      chaptersPerDay: 1,
    }
    const wisdomPlan: ReadingPlanState = {
      sectionId: "wisdom",
      lastBookId: "JOB",
      lastChapter: 2,
      chaptersPerDay: 1,
    }
    setReadingPlan(psalmsPlan, { setActive: true })
    setReadingPlan(wisdomPlan, { setActive: false })
    expect(listReadingPlans()).toHaveLength(2)
    expect(getReadingPlan()?.sectionId).toBe("psalms")
    setActiveReadingPlan("wisdom")
    expect(getActiveReadingPlan()?.sectionId).toBe("wisdom")
  })

  it("marks a plan complete when the final chapter is advanced", () => {
    const psalmsPlan: ReadingPlanState = {
      sectionId: "psalms",
      lastBookId: "PSA",
      lastChapter: 149,
      chaptersPerDay: 1,
    }
    const completed = advanceReadingPlan(psalmsPlan, "PSA", 150, 150)
    expect(completed).not.toBeNull()
    expect(isReadingPlanComplete(completed!)).toBe(true)
    expect(getNextChapter(completed!)).toBeNull()
  })
})
