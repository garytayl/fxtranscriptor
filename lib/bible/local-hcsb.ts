import "server-only"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { BIBLE_BOOKS_WITH_CHAPTER_COUNTS, getBookTestament } from "@/lib/bible/constants"
import { slugifyBookName } from "@/lib/bible/reference"
import type { BibleBook, BibleChapter, BibleVerse } from "@/lib/bible/types"

export const LOCAL_HCSB_BIBLE_ID = "local-HCSB"
const TRANSLATION_SLUG = "HCSB"

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
    text: row.text as string,
  }))

  return {
    reference: `${book.name} ${chapterNumber}`,
    verses,
  }
}
