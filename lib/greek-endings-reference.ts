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
    plainMeaning:
      "The subject case: who or what performs the verb, or what the clause is about. In equative sentences ('X is Y'), both the subject and the predicate noun or adjective are usually nominative so they match the same entity.",
    quickExample:
      "ὁ ἄνθρωπος γράφει -> 'the man writes': ἄνθρωπος is nominative because he is the doer. ὁ θεὸς ἀγάπη ἐστίν -> 'God is love': θεός and ἀγάπη both stay nominative because they name the same thing from two angles.",
  },
  {
    term: "Genitive",
    plainMeaning:
      "Marks source, owner, or 'belongs to' relationships—English often uses 'of,' 'from,' or possessive 's.' It can also be partitive ('some of the crowd') or depend on certain verbs and prepositions that simply take the genitive in Greek.",
    quickExample:
      "λόγος θεοῦ -> 'word of God': God is the source or possessor. μέρος τῶν μαθητῶν -> 'part of the disciples': partitive—out of the whole group. Many prepositions (e.g. ἐκ, ἀπό) govern the genitive.",
  },
  {
    term: "Dative",
    plainMeaning:
      "Most often the indirect object: who receives the action on the side—whom you speak to, give to, teach, and so on. Greek still uses dative when English drops the word 'to.' Also used for place (where) and means (with what).",
    quickExample:
      "λέγει τῷ Πέτρῳ -> 'he says to Peter': Peter is dative; English keeps 'to.' διδάσκει τοῖς μαθηταῖς -> 'he teaches the disciples': same idea—they receive the teaching—even though English usually does not say 'to the disciples.'",
  },
  {
    term: "Accusative",
    plainMeaning:
      "The direct object case: whoever or whatever the verb most directly acts on—what you see, send, love, or teach as the content of the action. Also used for extent (how far, how long) and as the object of many prepositions (e.g. motion into εἰς + accusative).",
    quickExample:
      "βλέπω τὸν ἄνθρωπον -> 'I see the man': he is what is seen. ἀγαπᾷ τὸν κόσμον -> 'he loves the world': the world is the direct object. εἰς τὸν οἶκον -> 'into the house': οἶκον is accusative after εἰς.",
  },
  {
    term: "Tense",
    plainMeaning:
      "Greek tense often signals how an action is viewed—ongoing, completed as a whole, background, or with lasting result—not a one-to-one map to English past/present/future. Translators choose English tense from context; your job is to notice the Greek 'camera angle.'",
    quickExample:
      "Present indicative is often progressive ('is walking') but can be gnomic or customary ('lions devour prey'). Aorist often presents one bounded event ('he spoke' as a whole). Perfect ties a completed action to a present state or result.",
  },
  {
    term: "Voice",
    plainMeaning:
      "Active: the subject does the action. Passive: the subject is acted upon. Middle (and many 'deponent' verbs that look middle or passive in form) often carries reflexive, self-interest, or process nuance—English may still use an active translation, so learn verbs in context.",
    quickExample:
      "Active γράφει -> 'he writes.' Passive γράφεται -> 'it is written' or 'he is being written about,' depending on context. Many NT verbs have middle forms but read like actives in English—endings flag form; lexicons flag meaning.",
  },
  {
    term: "Mood",
    plainMeaning:
      "Mood is what the verb is doing in the sentence: stating a fact or question (indicative), giving a command (imperative), expressing purpose, fear, or uncertainty (subjunctive), or (rarely in the NT) a polite wish or potential (optative).",
    quickExample:
      "λύει -> 'he looses' (indicative, plain statement). λῦσον -> 'loose!' (imperative). ἵνα λύσῃ -> 'so that he might loose' (purpose; subjunctive after ἵνα). Moods show up in main clauses and in subordinate clauses alike.",
  },
  {
    term: "Person + Number",
    plainMeaning:
      "Person is viewpoint: I / you / he-she-it. Number is how many 'actors' share that ending (singular vs plural). Greek finite verbs spell out person and number in the ending, so explicit pronouns are often omitted unless emphasized.",
    quickExample:
      "λύω 'I loose,' λύεις 'you (sg.) loose,' λύει 'he/she/it looses,' λύομεν 'we loose,' λύετε 'you (pl.) loose,' λύουσι(ν) 'they loose.' Same verb stem, different suffix—always check who the ending points to before you translate.",
  },
]
