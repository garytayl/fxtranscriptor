/** Reference tables & sections for Endings Lab (no React — safe for tests and imports). */

export type EndingsTable = {
  id: string
  title: string
  subtitle: string
  columns: string[]
  rows: string[][]
}

export type EndingsSectionRow = {
  label: string
  ending: string
  notes?: string
}

export type EndingsSection = {
  id: string
  title: string
  description: string
  rows: EndingsSectionRow[]
}

export const ENDINGS_TABLES: EndingsTable[] = [
  {
    id: "verb-present-active",
    title: "Present active indicative endings",
    subtitle: "Core omega-verb endings you see constantly.",
    columns: ["Person", "Singular", "Plural"],
    rows: [
      ["1st", "-ω", "-ομεν"],
      ["2nd", "-εις", "-ετε"],
      ["3rd", "-ει", "-ουσι(ν)"],
    ],
  },
  {
    id: "verb-aorist-active",
    title: "Aorist active indicative endings",
    subtitle: "Most common active past-tense pattern.",
    columns: ["Person", "Singular", "Plural"],
    rows: [
      ["1st", "-σα", "-σαμεν"],
      ["2nd", "-σας", "-σατε"],
      ["3rd", "-σε(ν)", "-σαν"],
    ],
  },
  {
    id: "noun-2nd-masc-neut",
    title: "2nd declension noun endings",
    subtitle: "Masculine and neuter noun/article-friendly patterns.",
    columns: ["Case", "Masc sg/pl", "Neut sg/pl"],
    rows: [
      ["Nominative", "-ος / -οι", "-ον / -α"],
      ["Genitive", "-ου / -ων", "-ου / -ων"],
      ["Dative", "-ῳ / -οις", "-ῳ / -οις"],
      ["Accusative", "-ον / -ους", "-ον / -α"],
    ],
  },
  {
    id: "article",
    title: "Definite article endings (ὁ, ἡ, τό)",
    subtitle: "Fast pattern recognition for article + noun agreement.",
    columns: ["Case", "Masculine", "Feminine", "Neuter"],
    rows: [
      ["Nom sg", "ὁ", "ἡ", "τό"],
      ["Gen sg", "τοῦ", "τῆς", "τοῦ"],
      ["Dat sg", "τῷ", "τῇ", "τῷ"],
      ["Acc sg", "τόν", "τήν", "τό"],
      ["Nom pl", "οἱ", "αἱ", "τά"],
      ["Gen pl", "τῶν", "τῶν", "τῶν"],
      ["Dat pl", "τοῖς", "ταῖς", "τοῖς"],
      ["Acc pl", "τούς", "τάς", "τά"],
    ],
  },
]

export const ENDINGS_SECTIONS: EndingsSection[] = [
  {
    id: "present-active",
    title: "Present active verb endings",
    description: "Core omega-verb endings you will see constantly.",
    rows: [
      { label: "1st singular", ending: "-ω", notes: "I ..." },
      { label: "2nd singular", ending: "-εις", notes: "you ..." },
      { label: "3rd singular", ending: "-ει", notes: "he/she/it ..." },
      { label: "1st plural", ending: "-ομεν", notes: "we ..." },
      { label: "2nd plural", ending: "-ετε", notes: "you all ..." },
      { label: "3rd plural", ending: "-ουσι(ν)", notes: "they ..." },
    ],
  },
  {
    id: "aorist-active",
    title: "Aorist active verb endings",
    description: "Frequent simple-past active forms.",
    rows: [
      { label: "1st singular", ending: "-σα" },
      { label: "2nd singular", ending: "-σας" },
      { label: "3rd singular", ending: "-σε(ν)" },
      { label: "1st plural", ending: "-σαμεν" },
      { label: "2nd plural", ending: "-σατε" },
      { label: "3rd plural", ending: "-σαν" },
    ],
  },
  {
    id: "second-declension",
    title: "2nd declension noun endings",
    description: "Masculine + neuter patterns for fast case recognition.",
    rows: [
      { label: "Masc nom singular", ending: "-ος" },
      { label: "Masc gen singular", ending: "-ου" },
      { label: "Masc dat singular", ending: "-ῳ" },
      { label: "Masc acc singular", ending: "-ον" },
      { label: "Neut nom/acc singular", ending: "-ον" },
      { label: "Neut nom/acc plural", ending: "-α" },
    ],
  },
  {
    id: "article",
    title: "Definite article forms",
    description: "Use article+noun agreement as a grammar shortcut.",
    rows: [
      { label: "Masc nom sg", ending: "ὁ" },
      { label: "Feminine gen sg", ending: "τῆς" },
      { label: "Neuter nom/acc pl", ending: "τά" },
      { label: "Genitive plural (all genders)", ending: "τῶν" },
    ],
  },
]

export type GrammarGlossaryItem = {
  term: string
  plainMeaning: string
  quickExample: string
}

export const GRAMMAR_GLOSSARY: GrammarGlossaryItem[] = [
  {
    term: "Nominative",
    plainMeaning: "Usually the subject - who/what is doing the action.",
    quickExample: "ὁ ἄνθρωπος γράφει -> 'the man writes' (man = subject).",
  },
  {
    term: "Genitive",
    plainMeaning: "Usually possession or source - often 'of'.",
    quickExample: "λόγος θεοῦ -> 'word of God'.",
  },
  {
    term: "Dative",
    plainMeaning: "Often indirect object, location, or means - 'to/for/in/by'.",
    quickExample: "διδάσκει τοῖς μαθηταῖς -> 'he teaches the disciples'.",
  },
  {
    term: "Accusative",
    plainMeaning: "Usually direct object - who/what receives the action.",
    quickExample: "βλέπω τὸν ἄνθρωπον -> 'I see the man'.",
  },
  {
    term: "Tense",
    plainMeaning: "The kind of action (ongoing, completed, simple snapshot, etc.).",
    quickExample: "Present often feels ongoing; aorist often feels like a whole event.",
  },
  {
    term: "Voice",
    plainMeaning: "How subject relates to action (does it, receives it, or acts with stake in it).",
    quickExample: "Active = 'he writes', passive = 'he is written/treated'.",
  },
  {
    term: "Mood",
    plainMeaning: "How the verb is framed (statement, command, wish, possibility).",
    quickExample: "Indicative states facts; imperative gives commands.",
  },
  {
    term: "Person + Number",
    plainMeaning: "Who is involved and how many (I/you/he, singular/plural).",
    quickExample: "-ω = I..., -εις = you..., -ομεν = we....",
  },
]
