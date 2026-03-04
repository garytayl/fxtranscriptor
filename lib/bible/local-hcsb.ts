import "server-only"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { BIBLE_BOOKS_WITH_CHAPTER_COUNTS, getBookTestament } from "@/lib/bible/constants"
import { slugifyBookName } from "@/lib/bible/reference"
import type { BibleBook, BibleChapter, BibleVerse } from "@/lib/bible/types"

export const LOCAL_HCSB_BIBLE_ID = "local-HCSB"
const TRANSLATION_SLUG = "HCSB"

/** Remove HTML tags from verse text (e.g. <em>, <strong> from imports). */
function stripVerseHtml(raw: string): string {
  return raw.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
}

export function getLocalHcsbBooks(): BibleBook[] {
  return BIBLE_BOOKS_WITH_CHAPTER_COUNTS.map((book) => ({
    id: book.id,
    name: book.name,
    slug: slugifyBookName(book.name),
    testament: getBookTestament(book.id),
  }))
}

export function getLocalHcsbBookBySlug(slug: string): BibleBook | null {
  const books = getLocalHcsbBooks()
  const normalized = slug.toLowerCase().trim()
  return books.find((b) => b.slug === normalized) ?? null
}

export function getLocalHcsbChapters(bookId: string): BibleChapter[] {
  const book = BIBLE_BOOKS_WITH_CHAPTER_COUNTS.find((b) => b.id === bookId)
  if (!book) return []
  return Array.from({ length: book.chapters }, (_, i) => ({
    id: `${bookId}-${i + 1}`,
    number: i + 1,
    reference: `${book.name} ${i + 1}`,
  }))
}

export async function getLocalHcsbChapterVerses(
  bookId: string,
  chapterNumber: number
): Promise<{ reference: string; verses: BibleVerse[] }> {
  const book = BIBLE_BOOKS_WITH_CHAPTER_COUNTS.find((b) => b.id === bookId)
  if (!book || chapterNumber < 1 || chapterNumber > book.chapters) {
    return { reference: "", verses: [] }
  }
  const bookSlug = slugifyBookName(book.name)
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("bible_verses")
    .select("verse_number, text")
    .eq("translation_slug", TRANSLATION_SLUG)
    .eq("book_slug", bookSlug)
    .eq("chapter_number", chapterNumber)
    .order("verse_number", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const verses: BibleVerse[] = (data ?? []).map((row) => ({
    number: row.verse_number as number,
    text: stripVerseHtml((row.text as string) ?? ""),
  }))

  return {
    reference: `${book.name} ${chapterNumber}`,
    verses,
  }
}

export type BibleFootnote = {
  verseNumber: number
  marker: string
  text: string
  kind?: string | null
  targetBookSlug?: string | null
  targetChapter?: number | null
  targetVerse?: number | null
}

export async function getLocalHcsbChapterFootnotes(
  bookId: string,
  chapterNumber: number
): Promise<BibleFootnote[]> {
  const book = BIBLE_BOOKS_WITH_CHAPTER_COUNTS.find((b) => b.id === bookId)
  if (!book || chapterNumber < 1 || chapterNumber > book.chapters) {
    return []
  }
  const bookSlug = slugifyBookName(book.name)
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("bible_footnotes")
    .select("verse_number, marker, text, kind, target_book_slug, target_chapter, target_verse")
    .eq("translation_slug", TRANSLATION_SLUG)
    .eq("book_slug", bookSlug)
    .eq("chapter_number", chapterNumber)
    .order("verse_number", { ascending: true })
    .order("marker", { ascending: true })

  if (error) {
    return []
  }

  return (data ?? []).map((row) => ({
    verseNumber: row.verse_number as number,
    marker: row.marker as string,
    text: row.text as string,
    kind: row.kind as string | null,
    targetBookSlug: row.target_book_slug as string | null,
    targetChapter: row.target_chapter as number | null,
    targetVerse: row.target_verse as number | null,
  }))
}
