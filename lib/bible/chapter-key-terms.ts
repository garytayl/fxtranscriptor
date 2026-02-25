/**
 * Optional Greek/Hebrew key terms per chapter for the scripture reader "Dive deeper" section.
 * Key: "bookSlug-chapterNumber" (e.g. "john-3", "jonah-4"). Value: Strong's codes to show.
 * Expand as needed; add more chapters or source from a dataset later.
 */

const CHAPTER_KEY_TERMS: Record<string, string[]> = {
  "john-3": ["G25", "G26", "G4100", "G3056"],
  "jonah-4": ["H7725", "H3068", "H7451"],
}

export function getKeyTermsForChapter(bookSlug: string, chapterNumber: number): string[] {
  const key = `${bookSlug.toLowerCase()}-${chapterNumber}`
  return CHAPTER_KEY_TERMS[key] ?? []
}
