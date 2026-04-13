/**
 * Original-language morphology (pilot: Greek John 1 from MorphGNT).
 * Strong's maps KJV English → lemma; morphology maps Greek surface forms → grammar.
 */

export type GreekMorphToken = {
  /** Surface form for display (punctuation may be attached in source) */
  text: string
  word: string
  lemma: string
  /** MorphGNT part-of-speech code, e.g. V-, N-, RA */
  pos: string
  /** Robinson-style parse field from MorphGNT */
  parse: string
}

export type GreekMorphExpanded = {
  posLabel: string
  /** Plain-language parsing line */
  parseSummary: string
  /** Short teaching notes keyed off labels (not raw codes) */
  grammarCards: string[]
  /** One-sentence orientation for learners */
  plainEnglishLead: string
  /** Short titled sections (tense, participle, mood, case…) */
  learningSections: { title: string; body: string }[]
}
