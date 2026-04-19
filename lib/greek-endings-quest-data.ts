/**
 * Endings Lab MCQ quests (shared by Endings Lab UI and Greek lesson runs).
 */

export type EndingsQuestGroup = "verb" | "noun" | "article"

export type EndingsQuest = {
  id: string
  group: EndingsQuestGroup
  prompt: string
  answer: string
  distractors: string[]
  explainer: string
  xp: number
}

export const ENDINGS_QUESTS: EndingsQuest[] = [
  {
    id: "verb-1",
    group: "verb",
    prompt: "Which ending is 2nd person singular present active?",
    answer: "-εις",
    distractors: ["-ω", "-ομεν", "-ουσι(ν)"],
    explainer: "Present active 2nd singular is -εις.",
    xp: 7,
  },
  {
    id: "verb-2",
    group: "verb",
    prompt: "You see a verb ending in -σατε. Which form is most likely?",
    answer: "2nd plural aorist active",
    distractors: ["1st singular aorist active", "3rd singular present active", "1st plural present active"],
    explainer: "-σατε is the common 2nd plural aorist active ending.",
    xp: 8,
  },
  {
    id: "verb-3",
    group: "verb",
    prompt: "Pick the normal 3rd plural present active ending.",
    answer: "-ουσι(ν)",
    distractors: ["-ει", "-ετε", "-σαν"],
    explainer: "3rd plural present active is typically -ουσι(ν).",
    xp: 7,
  },
  {
    id: "noun-1",
    group: "noun",
    prompt: "For 2nd declension masculine, what is nominative singular?",
    answer: "-ος",
    distractors: ["-ου", "-οι", "-ον"],
    explainer: "2nd declension masculine nominative singular is -ος.",
    xp: 7,
  },
  {
    id: "noun-2",
    group: "noun",
    prompt: "A neuter plural nominative/accusative ending is usually:",
    answer: "-α",
    distractors: ["-οι", "-ους", "-ων"],
    explainer: "Neuter plural nominative and accusative commonly use -α.",
    xp: 8,
  },
  {
    id: "article-1",
    group: "article",
    prompt: "Which article form is feminine genitive singular?",
    answer: "τῆς",
    distractors: ["τῇ", "τῶν", "τήν"],
    explainer: "Feminine genitive singular article is τῆς.",
    xp: 7,
  },
  {
    id: "article-2",
    group: "article",
    prompt: "Which is neuter nominative/accusative plural article?",
    answer: "τά",
    distractors: ["οἱ", "αἱ", "τούς"],
    explainer: "Neuter nominative/accusative plural article is τά.",
    xp: 7,
  },
]
