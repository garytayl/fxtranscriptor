import { describe, it, expect } from "vitest"
import { ROMANS_JOURNEY_STEPS, ROMANS_JOURNEY_TOTAL } from "@/lib/romans-journey-data"

describe("romans-journey-data", () => {
  it("has 25 aligned steps with refs and prompts", () => {
    expect(ROMANS_JOURNEY_TOTAL).toBe(25)
    expect(ROMANS_JOURNEY_STEPS.length).toBe(25)
    expect(ROMANS_JOURNEY_STEPS[0].passageRef).toBe("Romans 1:1-17")
    expect(ROMANS_JOURNEY_STEPS[24].passageRef).toBe("Romans 16:1-27")
    expect(ROMANS_JOURNEY_STEPS[12].reflectionPrompt.length).toBeGreaterThan(10)
  })
})
