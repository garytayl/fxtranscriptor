/**
 * Plain-language “grammar cards” for Greek morphological categories.
 * Used as teaching tooltips alongside MorphGNT-style parses.
 */

const CASE: Record<string, string> = {
  N: "Nominative often marks the subject of the verb or a predicate noun (“is X”).",
  G: "Genitive often shows possession, source, or “of” relationships (like Hebrew construct chains).",
  D: "Dative often marks the indirect object, location, or “to/for” reference.",
  A: "Accusative often marks the direct object—what receives the action of the verb.",
  V: "Vocative is direct address (“O …”).",
}

const TENSE: Record<string, string> = {
  P: "Present tense often (not always) marks ongoing or customary action in the narrative present.",
  I: "Imperfect usually marks past action as ongoing, repeated, or background in narrative.",
  F: "Future marks action anticipated after the speech moment.",
  A: "Aorist often marks the action as a whole (summary viewpoint)—very common in narrative.",
  X: "Perfect tense emphasizes a past action with ongoing result or state.",
  Y: "Pluperfect marks completed action further in the past, with result up to a past reference point.",
  T: "Future perfect (rare) marks completed state before a future reference.",
}

const MOOD_FINITE: Record<string, string> = {
  I: "Indicative is the mood of factual statement in independent clauses.",
  D: "Imperative is the mood of command or entreaty.",
  S: "Subjunctive often appears in purpose clauses, exhortations, or indefinite contexts.",
  O: "Optative is rare; it can mark wish or potential in classical-influenced style.",
}

const VOICE: Record<string, string> = {
  A: "Active: the subject performs the action.",
  M: "Middle often marks action directed toward the subject, reflexive nuance, or deponent verbs.",
  P: "Passive: the subject receives the action.",
}

const PARTICIPLE_NOTE =
  "Participles are verbal adjectives: they can pack a whole clause into one word (who/which/while doing …)."

const INFINITIVE_NOTE =
  "Infinitives are verbal nouns (“to …”); Greek often chains them to express purpose, result, or dependent action."

export function grammarCardsForGreekExpanded(parts: {
  caseKey?: string
  tenseKey?: string
  moodKey?: string
  voiceKey?: string
  isParticiple?: boolean
  isInfinitive?: boolean
}): string[] {
  const out: string[] = []
  if (parts.isInfinitive) out.push(INFINITIVE_NOTE)
  if (parts.isParticiple) out.push(PARTICIPLE_NOTE)
  if (parts.tenseKey && TENSE[parts.tenseKey]) out.push(TENSE[parts.tenseKey])
  if (parts.voiceKey && VOICE[parts.voiceKey]) out.push(VOICE[parts.voiceKey])
  if (parts.moodKey && MOOD_FINITE[parts.moodKey]) out.push(MOOD_FINITE[parts.moodKey])
  if (parts.caseKey && CASE[parts.caseKey]) out.push(CASE[parts.caseKey])
  return out
}
