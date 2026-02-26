/**
 * Extract verse references from plain text (e.g. transcript) via regex + parse.
 * Use to supplement AI-extracted verses so we don't miss refs mentioned in speech.
 */

import { parsePassageReference } from "./reference";

export type ExtractedVerse = {
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number | null;
  full_reference: string;
};

/**
 * Regex to find candidate "Book Chapter:Verse" or "Book Chapter:Verse-Verse" in text.
 * Captures: (book part)(space)(chapter):(verse)(optional -verseEnd)
 */
const VERSE_IN_TEXT =
  /\b(\d?\s*[A-Za-z][A-Za-z\s]*?)\s+(\d+):(\d+)(?:-(\d+))?\b/g;

/**
 * Extract all verse references from text and return normalized form.
 * Dedupes by full_reference.
 */
export function extractVerseReferencesFromText(text: string | null | undefined): ExtractedVerse[] {
  if (!text || typeof text !== "string") return [];

  const seen = new Set<string>();
  const out: ExtractedVerse[] = [];

  let m: RegExpExecArray | null;
  VERSE_IN_TEXT.lastIndex = 0;
  while ((m = VERSE_IN_TEXT.exec(text)) !== null) {
    const bookPart = m[1].trim();
    const ch = m[2];
    const vStart = m[3];
    const vEnd = m[4] ?? null;
    const raw = vEnd ? `${bookPart} ${ch}:${vStart}-${vEnd}` : `${bookPart} ${ch}:${vStart}`;
    const parsed = parsePassageReference(raw);
    if (!parsed || !parsed.verseRange) continue;
    const verseStart = parsed.verseRange.start;
    const verseEnd = parsed.verseRange.end !== parsed.verseRange.start ? parsed.verseRange.end : null;
    const fullRef =
      verseEnd && verseEnd !== verseStart
        ? `${parsed.book} ${parsed.chapterNumber}:${verseStart}-${verseEnd}`
        : `${parsed.book} ${parsed.chapterNumber}:${verseStart}`;
    if (seen.has(fullRef)) continue;
    seen.add(fullRef);
    out.push({
      book: parsed.book,
      chapter: parsed.chapterNumber,
      verse_start: verseStart,
      verse_end: verseEnd && verseEnd !== verseStart ? verseEnd : null,
      full_reference: fullRef,
    });
  }

  return out;
}
