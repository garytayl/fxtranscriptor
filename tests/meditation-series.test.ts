import { describe, it, expect } from "vitest"
import {
  DAILY_SERIES_ID,
  getMeditationSeries,
  passageRefForSeries,
  passageCountForSeries,
  isDailySeriesId,
} from "@/lib/meditation-series"

describe("meditation-series", () => {
  it("resolves daily passage without using cursor", () => {
    expect(isDailySeriesId(DAILY_SERIES_ID)).toBe(true)
    const ref = passageRefForSeries(DAILY_SERIES_ID, 99)
    expect(ref.length).toBeGreaterThan(3)
  })

  it("cycles romans passages by index", () => {
    const s = getMeditationSeries("romans")
    expect(s?.passages.length).toBe(25)
    expect(s?.passageLabels?.length).toBe(25)
    const n = passageCountForSeries("romans")
    expect(passageRefForSeries("romans", 0)).toBe(s!.passages[0])
    expect(passageRefForSeries("romans", n)).toBe(s!.passages[0])
    expect(s!.passages[0]).toBe("Romans 1:1-17")
  })
})
