import type { GreekMorphToken } from "@/lib/bible/morph-types"

const CASE_LABELS: Record<string, string> = {
  N: "nominative",
  G: "genitive",
  D: "dative",
  A: "accusative",
  V: "vocative",
}

const NUMBER_LABELS: Record<string, string> = {
  S: "singular",
  P: "plural",
}

const GENDER_LABELS: Record<string, string> = {
  M: "masculine",
  F: "feminine",
  N: "neuter",
}

const TENSE_LABELS: Record<string, string> = {
  P: "present",
  I: "imperfect",
  F: "future",
  A: "aorist",
  X: "perfect",
  Y: "pluperfect",
  T: "future perfect",
}

const VOICE_LABELS: Record<string, string> = {
  A: "active",
  M: "middle",
  P: "passive",
}

const MOOD_LABELS: Record<string, string> = {
  I: "indicative",
  D: "imperative",
  S: "subjunctive",
  O: "optative",
  N: "infinitive",
  P: "participle",
}

function normalizeParse(parse: string): string {
  const raw = (parse || "").trim()
  if (raw.length >= 8) return raw.slice(0, 8)
  return raw.padEnd(8, "-")
}

export type GreekWordLearningClues = {
  parseTemplate: string
  quickReason: string | null
  slotClues: string[]
  articleFunctionHint: string | null
}

export function buildGreekWordLearningClues(token: GreekMorphToken): GreekWordLearningClues {
  const parseTemplate = normalizeParse(token.parse)
  const slotClues: string[] = []
  let quickReason: string | null = null

  const caseCode = parseTemplate[4]
  const numberCode = parseTemplate[5]
  const genderCode = parseTemplate[6]

  if (token.pos.startsWith("V")) {
    const tenseCode = parseTemplate[1]
    const voiceCode = parseTemplate[2]
    const moodCode = parseTemplate[3]
    if (TENSE_LABELS[tenseCode]) {
      slotClues.push(`Tense slot (2): ${tenseCode} = ${TENSE_LABELS[tenseCode]}.`)
    }
    if (VOICE_LABELS[voiceCode]) {
      slotClues.push(`Voice slot (3): ${voiceCode} = ${VOICE_LABELS[voiceCode]}.`)
    }
    if (MOOD_LABELS[moodCode]) {
      slotClues.push(`Mood slot (4): ${moodCode} = ${MOOD_LABELS[moodCode]}.`)
    }
    if (CASE_LABELS[caseCode]) {
      quickReason = `This form is ${CASE_LABELS[caseCode]} because case slot (5) is ${caseCode} in ${parseTemplate}.`
    }
  } else {
    if (CASE_LABELS[caseCode]) {
      quickReason = `This form is ${CASE_LABELS[caseCode]} because case slot (5) is ${caseCode} in ${parseTemplate}.`
      slotClues.push(`Case slot (5): ${caseCode} = ${CASE_LABELS[caseCode]}.`)
    }
    if (NUMBER_LABELS[numberCode]) {
      slotClues.push(`Number slot (6): ${numberCode} = ${NUMBER_LABELS[numberCode]}.`)
    }
    if (GENDER_LABELS[genderCode]) {
      slotClues.push(`Gender slot (7): ${genderCode} = ${GENDER_LABELS[genderCode]}.`)
    }
  }

  const articleFunctionHint =
    token.pos.trim() === "RA"
      ? "As the Greek article, this can mark a known person/thing and often works substantivally as 'the one' or simply 'he/she' from context."
      : null

  return {
    parseTemplate,
    quickReason,
    slotClues,
    articleFunctionHint,
  }
}
