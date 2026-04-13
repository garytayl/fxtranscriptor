/**
 * Structured “mini-lesson” blocks for Greek morphology (pedagogy layer).
 * Paired with MorphGNT parses in the reader sidebar.
 */

import type { GreekMorphToken } from "@/lib/bible/morph-types"

export type GreekLearningSection = {
  title: string
  body: string
}

function normParse(p: string): string {
  const raw = (p || "").trim()
  if (raw.length >= 8) return raw.slice(0, 8)
  return raw.padEnd(8, "-")
}

const TENSE_NAME: Record<string, string> = {
  P: "Present",
  I: "Imperfect",
  F: "Future",
  A: "Aorist",
  X: "Perfect",
  Y: "Pluperfect",
  T: "Future perfect",
}

const MOOD_NAME: Record<string, string> = {
  I: "Indicative",
  D: "Imperative",
  S: "Subjunctive",
  O: "Optative",
  N: "Infinitive",
  P: "Participle",
}

const VOICE_NAME: Record<string, string> = {
  A: "Active",
  M: "Middle",
  P: "Passive",
}

const CASE_NAME: Record<string, string> = {
  N: "Nominative",
  G: "Genitive",
  D: "Dative",
  A: "Accusative",
  V: "Vocative",
}

/**
 * One-sentence “why care” plus titled sections for the morphology sidebar.
 */
export function buildGreekLearningSections(token: GreekMorphToken): GreekLearningSection[] {
  const parseRaw = token.parse.trim()
  if (!parseRaw || parseRaw.replace(/-/g, "").length === 0) {
    return [
      {
        title: "Indeclinable form",
        body: "Words like prepositions and many conjunctions do not change spelling for case or tense here. Focus on how they connect phrases in this verse.",
      },
    ]
  }

  const p = normParse(parseRaw)
  const sections: GreekLearningSection[] = []

  if (token.pos.startsWith("V")) {
    const moodChar = p[3]

    if (moodChar === "P") {
      const t = p[1] !== "-" ? TENSE_NAME[p[1]] : "Verb"
      const v = p[2] !== "-" ? VOICE_NAME[p[2]] : ""
      const cs = p[4] !== "-" ? CASE_NAME[p[4]] : ""
      sections.push({
        title: "What is a participle?",
        body: "A participle is a verb form that behaves like an adjective: it describes a noun or adds a side clause (“the one who…”, “while …ing”). In English we might use a relative clause or “-ing” phrase; Greek often does it in one word. Notice the case ending: it must agree with the noun it modifies or stands in for.",
      })
      sections.push({
        title: `${t} ${v} participle`.trim(),
        body: `${t || "This form"} marks the verbal time/aspect of this participle; ${v || "the voice"} marks whether the subject does the action, acts on itself (middle), or receives it (passive). The ${cs || "case"} ending hooks this participle into the sentence (subject, object, etc.).`,
      })
      return sections
    }

    if (moodChar === "N") {
      const t = p[1] !== "-" ? TENSE_NAME[p[1]] : ""
      const v = p[2] !== "-" ? VOICE_NAME[p[2]] : ""
      sections.push({
        title: "What is an infinitive?",
        body: "The infinitive is the “to …” form of the verb (to see, to be, to love). Greek often strings infinitives with main verbs to express purpose, result, or indirect speech.",
      })
      sections.push({
        title: `${t} ${v} infinitive`,
        body: `${t} and ${v} describe how this infinitive relates in time and voice to the main verb in the clause.`,
      })
      return sections
    }

    const mood = p[3] !== "-" ? MOOD_NAME[p[3]] : ""
    const tense = p[1] !== "-" ? TENSE_NAME[p[1]] : ""
    const voice = p[2] !== "-" ? VOICE_NAME[p[2]] : ""

    sections.push({
      title: `${mood} mood`,
        body:
        mood === "Indicative"
          ? "Indicative is the default mood for statements of fact (“is,” “was,” “did”). When you see imperfect or aorist indicative, you are usually in narrative or direct speech."
          : mood === "Imperative"
            ? "Imperative is command or entreaty. Check who is addressed (2nd person singular vs plural) from context."
            : mood === "Subjunctive"
              ? "Subjunctive often appears in purpose (“so that”), exhortation (“let us”), or indefinite contexts. ἵνα + subjunctive is a classic purpose pattern."
              : mood === "Optative"
                ? "Optative is rare in the NT; it can express wish or potential. When you meet it, compare a few translations."
                : "This finite verb form carries the main assertion of its clause.",

    })

    if (tense) {
      sections.push({
        title: `${tense} tense (aspect)`,
        body: explainTenseForLearners(p[1]),
      })
    }

    if (voice) {
      sections.push({
        title: `${voice} voice`,
        body:
          voice === "Active"
            ? "Active: the grammatical subject does the action."
            : voice === "Middle"
              ? "Middle: action often concerns the subject (reflexive, reciprocal, or “deponent” verbs that look middle but act active in English)."
              : "Passive: the subject receives the action.",
      })
    }

    return sections
  }

  if (token.pos === "A-" || token.pos === "N-" || token.pos.startsWith("R") || token.pos === "RA") {
    const cs = p[4] !== "-" ? CASE_NAME[p[4]] : "Case"
    sections.push({
      title: `${cs} case`,
      body: explainCaseForLearners(p[4]),
    })
    return sections
  }

  return [
    {
      title: "Form in context",
      body: "Use the category and lemma to see how this word fits the clause. Tap other words in the verse to see how cases and verbs connect.",
    },
  ]
}

function explainTenseForLearners(code: string): string {
  switch (code) {
    case "P":
      return "Present often marks **ongoing, customary, or “dramatic present”** in narrative. It is not automatically “right now”—context decides."
    case "I":
      return "Imperfect is **past with texture**: ongoing, repeated, or background action (“was …ing,” “used to”)."
    case "F":
      return "Future points **forward** from the speech moment: expectation, promise, or prediction."
    case "A":
      return "Aorist is the **default past story tense** in narrative: often views the action as a whole (“snapshot”), not the internal duration. Very common for main events."
    case "X":
      return "Perfect tense stresses a **past action with a present result** or state: “has been … and still is.”"
    case "Y":
      return "Pluperfect is “**past of the past**”: completed before another past reference in the story."
    default:
      return "Tense in Greek carries **aspect** (how the action is viewed) as well as time. Compare nearby verbs in the verse."
  }
}

function explainCaseForLearners(code: string): string {
  switch (code) {
    case "N":
      return "Nominative typically marks the **subject** or a **predicate noun** after “is” verbs."
    case "G":
      return "Genitive often answers “**whose?**” or “**of what?**”—possession, source, or part-whole (Hebrew construct-style relationships often map here)."
    case "D":
      return "Dative often marks **indirect object**, **reference**, **location**, or **means** (“to/for/with”)."
    case "A":
      return "Accusative often marks the **direct object**—what is acted upon—or extent of space/time."
    case "V":
      return "Vocative is **direct address**: “O Lord,” “my son.”"
    default:
      return "Case endings show how this word **relates** to the rest of the clause."
  }
}

/** One-line summary for the top of the sidebar. */
export function buildGreekPlainEnglishLead(token: GreekMorphToken, parseSummary: string): string {
  const parseRaw = token.parse.trim()
  if (!parseRaw || parseRaw.replace(/-/g, "").length === 0) {
    return "This word does not change form for tense or case here; see how it links the rest of the sentence."
  }
  const p = normParse(parseRaw)
  if (token.pos.startsWith("V")) {
    if (p[3] === "P") {
      return `This word is a participle: a verbal adjective (“who/which/while …”) showing ${parseSummary}.`
    }
    if (p[3] === "N") {
      return `This word is an infinitive (“to …”) in ${parseSummary}.`
    }
    return `This word is a finite verb: ${parseSummary}.`
  }
  if (token.pos === "A-" || token.pos === "N-" || token.pos.startsWith("R") || token.pos === "RA") {
    return `This word shows ${parseSummary}—the ending tells you its job in the phrase.`
  }
  return `Parsing: ${parseSummary}.`
}
