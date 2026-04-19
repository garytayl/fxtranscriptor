import { describe, expect, it } from "vitest"

import {
  buildLessonDrafts,
  DEFAULT_LESSON_CARD_COUNT,
  lessonSessionKey,
  lessonVocabMemoryKey,
  LESSON_ENDINGS_COUNT,
  LESSON_GLOSS_EN_COUNT,
  LESSON_GLOSS_LEMMA_EN_COUNT,
  LESSON_MORPH_COUNT,
  LESSON_ROOTS_COUNT,
} from "@/lib/greek-lesson-session"
import { ENDINGS_QUESTS } from "@/lib/greek-endings-quest-data"

describe("Greek lesson session drafts", () => {
  it("is deterministic for a fixed seed", () => {
    const a = buildLessonDrafts(4242)
    const b = buildLessonDrafts(4242)
    expect(a.runId).toBe(b.runId)
    expect(a.drafts.length).toBe(b.drafts.length)
    expect(JSON.stringify(a.drafts)).toBe(JSON.stringify(b.drafts))
  })

  it("produces the default card count and mix of kinds", () => {
    const { drafts, runId } = buildLessonDrafts(999)
    expect(drafts).toHaveLength(DEFAULT_LESSON_CARD_COUNT)
    expect(runId).toBe((999).toString(36))
    const kinds = { endings: 0, glossEn: 0, glossLemmaEn: 0, morph: 0, root: 0 }
    for (const d of drafts) {
      if (d.kind === "endings") kinds.endings++
      else if (d.kind === "gloss_en_to_lemma") kinds.glossEn++
      else if (d.kind === "gloss_lemma_to_en") kinds.glossLemmaEn++
      else if (d.kind === "root") kinds.root++
      else kinds.morph++
    }
    expect(kinds.endings).toBe(Math.min(LESSON_ENDINGS_COUNT, ENDINGS_QUESTS.length))
    expect(kinds.glossEn).toBe(LESSON_GLOSS_EN_COUNT)
    expect(kinds.glossLemmaEn).toBe(LESSON_GLOSS_LEMMA_EN_COUNT)
    expect(kinds.morph).toBe(LESSON_MORPH_COUNT)
    expect(kinds.root).toBe(LESSON_ROOTS_COUNT)
  })

  it("keeps drafts structurally valid", () => {
    const { drafts } = buildLessonDrafts(77)
    for (const d of drafts) {
      if (d.kind === "endings") {
        expect(d.options.length).toBeGreaterThanOrEqual(2)
        expect(d.options.length).toBeLessThanOrEqual(4)
        expect(d.correctIndex).toBeGreaterThanOrEqual(0)
        expect(d.correctIndex).toBeLessThan(d.options.length)
        expect(ENDINGS_QUESTS.some((q) => q.id === d.questId)).toBe(true)
        expect(d.options[d.correctIndex]).toBe(ENDINGS_QUESTS.find((q) => q.id === d.questId)?.answer)
        expect(d.topic.length).toBeGreaterThan(0)
      } else if (d.kind === "gloss_en_to_lemma") {
        expect(d.options).toHaveLength(4)
        expect(new Set(d.options).size).toBe(4)
        expect(d.correctIndex).toBeGreaterThanOrEqual(0)
        expect(d.correctIndex).toBeLessThan(4)
        expect(d.hint.trim().length).toBeGreaterThan(0)
        expect(d.prompt).toContain("“")
        expect(d.wordMemoryKey).toBe(lessonVocabMemoryKey(d.options[d.correctIndex]!))
      } else if (d.kind === "gloss_lemma_to_en") {
        expect(d.options).toHaveLength(4)
        expect(new Set(d.options).size).toBe(4)
        expect(d.correctIndex).toBeGreaterThanOrEqual(0)
        expect(d.correctIndex).toBeLessThan(4)
        expect(d.hint.trim().length).toBeGreaterThan(0)
        expect(d.options[d.correctIndex]).toBeTruthy()
        expect(d.wordMemoryKey).toBe(lessonVocabMemoryKey(d.hint))
      } else if (d.kind === "root") {
        expect(d.options).toHaveLength(4)
        expect(new Set(d.options).size).toBe(4)
        expect(d.correctIndex).toBeGreaterThanOrEqual(0)
        expect(d.correctIndex).toBeLessThan(4)
        expect(d.hint.trim().length).toBeGreaterThan(0)
        expect(d.rootId.length).toBeGreaterThan(0)
        expect(d.prompt).toContain("“")
      } else {
        expect(d.passageRef).toMatch(/:\d+/)
        expect(d.xp).toBeGreaterThan(0)
      }
    }
  })

  it("biases toward weak lemmas when provided", () => {
    const weak = ["λόγος", "ἀγάπη"]
    const { drafts } = buildLessonDrafts(12345, { weakLemmas: weak })
    const vocab = drafts.filter((d) => d.kind === "gloss_en_to_lemma" || d.kind === "gloss_lemma_to_en")
    const hitsWeakTopic = vocab.filter((d) => d.topic.includes("review")).length
    expect(vocab.length).toBeGreaterThan(0)
    expect(hitsWeakTopic).toBeGreaterThan(0)
  })

  it("uses distinct session keys per card index", () => {
    const keys = new Set<string>()
    const dateKey = "2026-04-13"
    const runId = "abc"
    for (let i = 0; i < 10; i++) {
      keys.add(lessonSessionKey(dateKey, runId, i, "endings"))
    }
    expect(keys.size).toBe(10)
  })
})
