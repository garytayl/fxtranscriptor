import { describe, expect, it } from "vitest"
import {
  assignmentForSeriesStep,
  buildSeriesPlan,
  BIBLE_READING_SERIES,
  describeSeriesPace,
  expectedSeriesStepIndex0,
  inclusiveDaySpan,
  parseQuestTrack,
  seriesPaceDeltaVerses,
  seriesPlanTotalVerses,
} from "@/lib/quest-bible-series"

describe("quest-bible-series", () => {
  it("builds non-empty plans for every defined series", () => {
    for (const s of BIBLE_READING_SERIES) {
      const plan = buildSeriesPlan(s.id)
      expect(plan.length).toBeGreaterThan(0)
      expect(plan[0].levelKey).toMatch(/^[a-z0-9-]+-\d+-\d+$/)
    }
  })

  it("orders gospels as Matthew → John", () => {
    const plan = buildSeriesPlan("gospels")
    expect(plan[0].label).toMatch(/^Matthew\b/)
    const lastJohn = plan.filter((p) => p.label.startsWith("John")).pop()
    expect(lastJohn?.label).toMatch(/^John\b/)
  })

  it("full_nt includes more verses than gospels alone", () => {
    expect(seriesPlanTotalVerses("full_nt")).toBeGreaterThan(seriesPlanTotalVerses("gospels"))
  })

  it("inclusiveDaySpan counts calendar days inclusively", () => {
    expect(inclusiveDaySpan("2026-04-10", "2026-04-10")).toBe(1)
    expect(inclusiveDaySpan("2026-04-10", "2026-04-12")).toBe(3)
  })

  it("expectedSeriesStepIndex0 advances one verse per day", () => {
    expect(expectedSeriesStepIndex0("2026-04-10", "2026-04-10", 100)).toBe(0)
    expect(expectedSeriesStepIndex0("2026-04-10", "2026-04-11", 100)).toBe(1)
    expect(expectedSeriesStepIndex0("2026-04-10", "2026-04-19", 5)).toBe(4)
  })

  it("seriesPaceDeltaVerses marks behind when nextStepIndex lags expected", () => {
    const planLen = 50
    expect(seriesPaceDeltaVerses(0, "2026-04-01", "2026-04-05", planLen)).toBe(4)
    expect(seriesPaceDeltaVerses(4, "2026-04-01", "2026-04-05", planLen)).toBe(0)
    expect(seriesPaceDeltaVerses(6, "2026-04-01", "2026-04-05", planLen)).toBe(-2)
  })

  it("describeSeriesPace summarizes delta", () => {
    expect(describeSeriesPace(0)).toContain("On pace")
    expect(describeSeriesPace(2)).toContain("behind")
    expect(describeSeriesPace(-1)).toContain("ahead")
  })

  it("assignmentForSeriesStep returns null past end", () => {
    const plan = buildSeriesPlan("acts")
    expect(assignmentForSeriesStep(plan, plan.length)).toBeNull()
    expect(assignmentForSeriesStep(plan, -1)).toBeNull()
  })

  it("parseQuestTrack tolerates bad JSON and invalid shapes", () => {
    expect(parseQuestTrack(null).mode).toBe("calendar")
    expect(parseQuestTrack("").mode).toBe("calendar")
    expect(parseQuestTrack("{").mode).toBe("calendar")
    expect(parseQuestTrack(JSON.stringify({ mode: "series" })).mode).toBe("calendar")
    expect(
      parseQuestTrack(
        JSON.stringify({
          mode: "series",
          seriesId: "gospels",
          startDateKey: "2026-01-15",
          nextStepIndex: 3,
        }),
      ),
    ).toEqual({
      mode: "series",
      seriesId: "gospels",
      startDateKey: "2026-01-15",
      nextStepIndex: 3,
    })
  })
})
