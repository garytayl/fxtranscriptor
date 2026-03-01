/**
 * Reading plan sections: OT/NT groupings and single-book plans.
 * Book IDs match lib/bible/constants.ts and API book id (e.g. GEN, MAT).
 */

import {
  OLD_TESTAMENT_BOOK_IDS,
  NEW_TESTAMENT_BOOK_IDS,
} from "@/lib/bible/constants"

export type DevotionSection = {
  id: string
  label: string
  bookIds: string[]
}

// Multi-book sections (ordered)
const SECTIONS: DevotionSection[] = [
  {
    id: "law",
    label: "The Law",
    bookIds: ["GEN", "EXO", "LEV", "NUM", "DEU"],
  },
  {
    id: "history",
    label: "History",
    bookIds: ["JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST"],
  },
  {
    id: "wisdom",
    label: "Wisdom & Poetry",
    bookIds: ["JOB", "PSA", "PRO", "ECC", "SNG"],
  },
  {
    id: "major-prophets",
    label: "Major Prophets",
    bookIds: ["ISA", "JER", "LAM", "EZK", "DAN"],
  },
  {
    id: "minor-prophets",
    label: "Minor Prophets",
    bookIds: ["HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL"],
  },
  {
    id: "gospels",
    label: "The Gospels",
    bookIds: ["MAT", "MRK", "LUK", "JHN"],
  },
  {
    id: "acts",
    label: "Acts",
    bookIds: ["ACT"],
  },
  {
    id: "pauline",
    label: "Paul's Letters",
    bookIds: ["ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB"],
  },
  {
    id: "general-epistles",
    label: "General Epistles",
    bookIds: ["JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD"],
  },
  {
    id: "revelation",
    label: "Revelation",
    bookIds: ["REV"],
  },
]

/** Display name for a book ID when used as a single-book section. */
const BOOK_ID_TO_LABEL: Record<string, string> = {
  GEN: "Genesis", EXO: "Exodus", LEV: "Leviticus", NUM: "Numbers", DEU: "Deuteronomy",
  JOS: "Joshua", JDG: "Judges", RUT: "Ruth", "1SA": "1 Samuel", "2SA": "2 Samuel",
  "1KI": "1 Kings", "2KI": "2 Kings", "1CH": "1 Chronicles", "2CH": "2 Chronicles",
  EZR: "Ezra", NEH: "Nehemiah", EST: "Esther", JOB: "Job", PSA: "Psalms", PRO: "Proverbs",
  ECC: "Ecclesiastes", SNG: "Song of Solomon", ISA: "Isaiah", JER: "Jeremiah",
  LAM: "Lamentations", EZK: "Ezekiel", DAN: "Daniel", HOS: "Hosea", JOL: "Joel",
  AMO: "Amos", OBA: "Obadiah", JON: "Jonah", MIC: "Micah", NAM: "Nahum",
  HAB: "Habakkuk", ZEP: "Zephaniah", HAG: "Haggai", ZEC: "Zechariah", MAL: "Malachi",
  MAT: "Matthew", MRK: "Mark", LUK: "Luke", JHN: "John", ACT: "Acts",
  ROM: "Romans", "1CO": "1 Corinthians", "2CO": "2 Corinthians", GAL: "Galatians",
  EPH: "Ephesians", PHP: "Philippians", COL: "Colossians", "1TH": "1 Thessalonians",
  "2TH": "2 Thessalonians", "1TI": "1 Timothy", "2TI": "2 Timothy", TIT: "Titus",
  PHM: "Philemon", HEB: "Hebrews", JAS: "James", "1PE": "1 Peter", "2PE": "2 Peter",
  "1JN": "1 John", "2JN": "2 John", "3JN": "3 John", JUD: "Jude", REV: "Revelation",
}

const SECTION_BY_ID = new Map<string, DevotionSection>(
  SECTIONS.map((s) => [s.id, s])
)

/** All book IDs in canonical order (OT then NT). */
const ALL_BOOK_IDS = [...OLD_TESTAMENT_BOOK_IDS, ...NEW_TESTAMENT_BOOK_IDS]

/** Get section by id. Multi-book sections use predefined id; single-book use lowercased book id (e.g. "mat"). */
export function getSection(sectionId: string): DevotionSection | null {
  const lower = sectionId.toLowerCase()
  const predefined = SECTION_BY_ID.get(lower)
  if (predefined) return predefined
  const bookId = ALL_BOOK_IDS.find((id) => id.toLowerCase() === lower)
  if (bookId) {
    return {
      id: lower,
      label: BOOK_ID_TO_LABEL[bookId] ?? bookId,
      bookIds: [bookId],
    }
  }
  return null
}

/** All predefined multi-book sections. */
export function getPredefinedSections(): DevotionSection[] {
  return [...SECTIONS]
}

/** All sections including one per book (for "Start a reading plan" picker). */
export function getAllSections(): DevotionSection[] {
  const singleBookSections: DevotionSection[] = ALL_BOOK_IDS.map((bookId) => ({
    id: bookId.toLowerCase(),
    label: BOOK_ID_TO_LABEL[bookId] ?? bookId,
    bookIds: [bookId],
  }))
  return [...SECTIONS, ...singleBookSections]
}

/** Whether this section id is a predefined multi-book section (not single-book). */
export function isPredefinedSection(sectionId: string): boolean {
  return SECTION_BY_ID.has(sectionId.toLowerCase())
}

/** Book display names for a section, in order (e.g. ["Genesis", "Exodus", ...]). */
export function getSectionBookNames(section: DevotionSection): string[] {
  return section.bookIds.map((id) => BOOK_ID_TO_LABEL[id] ?? id)
}
