/**
 * Expands MorphGNT/CCAT-style parsing codes (Robinson-style) into readable Greek grammar labels.
 * Column semantics follow MorphGNT README: person, tense, voice, mood, case, number, gender, degree.
 */

import type { GreekMorphExpanded, GreekMorphToken } from "@/lib/bible/morph-types"
import { grammarCardsForGreekExpanded } from "@/lib/bible/grammar-cards-greek"
import { buildGreekLearningSections, buildGreekPlainEnglishLead } from "@/lib/bible/greek-grammar-learning"

const POS_NAMES: Record<string, string> = {
  "A-": "Adjective",
  "C-": "Conjunction",
  "D-": "Adverb",
  "I-": "Interjection",
  "N-": "Noun",
  "P-": "Preposition",
  RA: "Definite article",
  RD: "Demonstrative pronoun",
  RI: "Interrogative / indefinite pronoun",
  RP: "Personal pronoun",
  RR: "Relative pronoun",
  "V-": "Verb",
  "X-": "Particle",
}

const TENSE: Record<string, string> = {
  P: "present",
  I: "imperfect",
  F: "future",
  A: "aorist",
  X: "perfect",
  Y: "pluperfect",
  T: "future perfect",
}

const VOICE: Record<string, string> = {
  A: "active",
  M: "middle",
  P: "passive",
}

const MOOD: Record<string, string> = {
  I: "indicative",
  D: "imperative",
  S: "subjunctive",
  O: "optative",
  N: "infinitive",
  P: "participle",
}

const CASE: Record<string, string> = {
  N: "nominative",
  G: "genitive",
  D: "dative",
  A: "accusative",
  V: "vocative",
}

const NUMBER: Record<string, string> = {
  S: "singular",
  P: "plural",
}

const GENDER: Record<string, string> = {
  M: "masculine",
  F: "feminine",
  N: "neuter",
}

const PERSON: Record<string, string> = {
  "1": "1st person",
  "2": "2nd person",
  "3": "3rd person",
}

const DEGREE: Record<string, string> = {
  C: "comparative",
  S: "superlative",
}

/** MorphGNT parse column is 8 character positions (person…degree). */
function normParse(p: string): string {
  const raw = (p || "").trim()
  if (raw.length >= 8) return raw.slice(0, 8)
  return raw.padEnd(8, "-")
}

function isUnderspecified(parse: string): boolean {
  return parse.replace(/-/g, "").trim().length === 0
}

/** Mood character at index 3 in normalized 8-char parse (without dashes stripped for position). */
function expandVerbFinite(p: string): { summary: string; cards: ReturnType<typeof grammarCardsForGreekExpanded> } {
  const person = p[0] !== "-" ? PERSON[p[0]] : null
  const tense = p[1] !== "-" ? TENSE[p[1]] : null
  const voice = p[2] !== "-" ? VOICE[p[2]] : null
  const mood = p[3] !== "-" ? MOOD[p[3]] : null
  /** For finite verbs, number sits in slot 5 (slot 4 is unused “case” for verbs). */
  const num = p[5] !== "-" ? NUMBER[p[5]] : null
  const bits = [person, tense, voice, mood, num].filter(Boolean)
  const summary = bits.join(" ")
  return {
    summary,
    cards: grammarCardsForGreekExpanded({
      tenseKey: p[1] !== "-" ? p[1] : undefined,
      voiceKey: p[2] !== "-" ? p[2] : undefined,
      moodKey: p[3] !== "-" && ["I", "D", "S", "O"].includes(p[3]) ? p[3] : undefined,
      isParticiple: false,
      isInfinitive: false,
    }),
  }
}

function expandVerbParticiple(p: string): { summary: string; cards: ReturnType<typeof grammarCardsForGreekExpanded> } {
  const tense = p[1] !== "-" ? TENSE[p[1]] : null
  const voice = p[2] !== "-" ? VOICE[p[2]] : null
  const mood = "participle"
  const cs = p[4] !== "-" ? CASE[p[4]] : null
  const num = p[5] !== "-" ? NUMBER[p[5]] : null
  const gen = p[6] !== "-" ? GENDER[p[6]] : null
  const bits = [tense, voice, mood, cs, num, gen].filter(Boolean)
  return {
    summary: bits.join(" "),
    cards: grammarCardsForGreekExpanded({
      tenseKey: p[1] !== "-" ? p[1] : undefined,
      voiceKey: p[2] !== "-" ? p[2] : undefined,
      caseKey: p[4] !== "-" ? p[4] : undefined,
      isParticiple: true,
      isInfinitive: false,
    }),
  }
}

function expandVerbInfinitive(p: string): { summary: string; cards: ReturnType<typeof grammarCardsForGreekExpanded> } {
  const tense = p[1] !== "-" ? TENSE[p[1]] : null
  const voice = p[2] !== "-" ? VOICE[p[2]] : null
  const bits = [tense, voice, "infinitive"].filter(Boolean)
  return {
    summary: bits.join(" "),
    cards: grammarCardsForGreekExpanded({
      tenseKey: p[1] !== "-" ? p[1] : undefined,
      voiceKey: p[2] !== "-" ? p[2] : undefined,
      isInfinitive: true,
      isParticiple: false,
    }),
  }
}

function expandNominal(pos: string, p: string): { summary: string; cards: ReturnType<typeof grammarCardsForGreekExpanded> } {
  const cs = p[4] !== "-" ? CASE[p[4]] : null
  const num = p[5] !== "-" ? NUMBER[p[5]] : null
  const gen = p[6] !== "-" ? GENDER[p[6]] : null
  const deg = p[7] !== "-" && p[7] !== undefined ? DEGREE[p[7]] : null
  const bits = [cs, num, gen, deg].filter(Boolean)
  return {
    summary: bits.join(" "),
    cards: grammarCardsForGreekExpanded({
      caseKey: p[4] !== "-" ? p[4] : undefined,
    }),
  }
}

function finishExpanded(token: GreekMorphToken, partial: Omit<GreekMorphExpanded, "plainEnglishLead" | "learningSections">): GreekMorphExpanded {
  const parseSummary = partial.parseSummary
  return {
    ...partial,
    plainEnglishLead: buildGreekPlainEnglishLead(token, parseSummary),
    learningSections: buildGreekLearningSections(token),
  }
}

/**
 * Best-effort POS for MorphGNT-style parses when only lemma + parse are stored (e.g. word bank).
 * Does not replace API `pos`; used so `expandGreekMorphToken` can branch like live morphology.
 */
export function inferPosFromMorphgntParse(parse: string): string {
  const p = normParse(parse.trim())
  if (!p || isUnderspecified(p)) return "P-"

  const tense = p[1]
  const mood = p[3]
  const caseSlot = p[4]
  const hasTense = tense !== "-" && "PIAFXYT".includes(tense)

  if (hasTense && mood !== "-") {
    if ("IDSON".includes(mood)) return "V-"
    if (mood === "P") return "V-"
    if (mood === "N") return "V-"
  }

  if (caseSlot !== "-" && "NGDAV".includes(caseSlot)) {
    return "N-"
  }

  return "X-"
}

/** Reconstruct a token for sidebar expansion from word-bank memory (lemma + parse only). */
export function greekMorphTokenFromLemmaAndParse(lemma: string, parse: string): GreekMorphToken {
  const parseTrim = parse.trim()
  const w = lemma.trim()
  const pos = inferPosFromMorphgntParse(parseTrim)
  return {
    text: w,
    word: w,
    lemma: w,
    parse: parseTrim,
    pos,
  }
}

export function expandGreekMorphToken(token: GreekMorphToken): GreekMorphExpanded {
  const pos = token.pos.trim()
  const parseRaw = token.parse.trim()
  const posLabel = POS_NAMES[pos] ?? (pos.replace(/-/g, "").trim() || "Word")

  if (!parseRaw || isUnderspecified(parseRaw)) {
    return finishExpanded(token, {
      posLabel,
      parseSummary: "Form is indeclinable here (no case/tense parse).",
      grammarCards: [],
    })
  }

  const p = normParse(parseRaw)

  if (pos.startsWith("V")) {
    const moodChar = p[3]
    if (moodChar === "P") {
      const { summary, cards } = expandVerbParticiple(p)
      return finishExpanded(token, { posLabel, parseSummary: summary, grammarCards: [...new Set(cards)] })
    }
    if (moodChar === "N") {
      const { summary, cards } = expandVerbInfinitive(p)
      return finishExpanded(token, { posLabel, parseSummary: summary, grammarCards: [...new Set(cards)] })
    }
    const { summary, cards } = expandVerbFinite(p)
    return finishExpanded(token, { posLabel, parseSummary: summary, grammarCards: [...new Set(cards)] })
  }

  if (pos === "A-" || pos === "N-" || pos.startsWith("R") || pos === "RA") {
    const { summary, cards } = expandNominal(pos, p)
    return finishExpanded(token, {
      posLabel,
      parseSummary: summary || "See lemma and context.",
      grammarCards: [...new Set(cards)],
    })
  }

  return finishExpanded(token, {
    posLabel,
    parseSummary: parseRaw,
    grammarCards: [],
  })
}
