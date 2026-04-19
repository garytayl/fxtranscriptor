import { describe, expect, it } from "vitest"

import { buildEndingsQuestChoices } from "@/lib/greek-endings-quest-utils"
import { ENDINGS_TABLES } from "@/lib/greek-endings-reference"
import { ENDINGS_QUESTS } from "@/lib/greek-endings-quest-data"

describe("Greek Endings Lab data", () => {
  it("ships all core endings sections with rows", () => {
    expect(ENDINGS_TABLES.length).toBeGreaterThanOrEqual(4)
    for (const table of ENDINGS_TABLES) {
      expect(table.rows.length).toBeGreaterThan(0)
      for (const row of table.rows) {
        for (const cell of row) {
          expect(cell.trim().length).toBeGreaterThan(0)
        }
      }
    }
  })

  it("creates choices containing the answer and no duplicates", () => {
    for (const quest of ENDINGS_QUESTS) {
      const choices = buildEndingsQuestChoices(quest)
      expect(choices.length).toBe(4)
      expect(new Set(choices).size).toBe(4)
      expect(choices).toContain(quest.answer)
    }
  })
})
