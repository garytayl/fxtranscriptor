import "server-only"

import { getBookTestament } from "@/lib/bible/constants"
import { parseChapterHtmlToVerses, sanitizeChapterHtml } from "@/lib/bible/parse"
import { slugifyBookName } from "@/lib/bible/reference"
import type { BibleBook, BibleChapter, BibleChapterContent, BibleVerse } from "@/lib/bible/types"

const DEFAULT_BASE_URL = "https://api.scripture.api.bible/v1"
export const BIBLE_CACHE_SECONDS = 60 * 60

type ApiBibleResponse<T> = {
  data: T
}

type ApiBibleBook = {
  id: string
  name: string
  nameLong?: string
  abbreviation?: string
}

type ApiBibleChapter = {
  id: string
  number: string | number
  reference?: string
}

type ApiBibleChapterContent = {
  id: string
  bookId?: string
  number: string | number
  reference: string
  content: string
}

let cachedBooks: BibleBook[] | null = null
let cachedBooksAt = 0

function getBibleEnv(): { apiKey: string; bibleId: string; baseUrl: string } {
  const apiKey = process.env.API_BIBLE_KEY
  const bibleId = process.env.API_BIBLE_BIBLE_ID
  const baseUrl = process.env.API_BIBLE_BASE_URL || DEFAULT_BASE_URL

  const missing = []
  if (!apiKey) missing.push("API_BIBLE_KEY")
  if (!bibleId) missing.push("API_BIBLE_BIBLE_ID")
  if (!baseUrl) missing.push("API_BIBLE_BASE_URL")

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`)
  }

  return {
    apiKey: apiKey as string,
    bibleId: bibleId as string,
    baseUrl: baseUrl.replace(/\/$/, ""),
  }
}

async function bibleFetch<T>(path: string, searchParams?: Record<string, string | number | boolean>) {
  const { apiKey, baseUrl } = getBibleEnv()
  const url = new URL(`${baseUrl}${path}`)

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, String(value))
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      "api-key": apiKey,
    },
    next: {
      revalidate: BIBLE_CACHE_SECONDS,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API.Bible error ${response.status}: ${errorText || response.statusText}`)
  }

  return (await response.json()) as T
}

export async function listBooks(): Promise<ApiBibleBook[]> {
  const { bibleId } = getBibleEnv()
  const response = await bibleFetch<ApiBibleResponse<ApiBibleBook[]>>(`/bibles/${bibleId}/books`)
  return response.data ?? []
}

export async function listChapters(bookId: string): Promise<BibleChapter[]> {
  const { bibleId } = getBibleEnv()
  const response = await bibleFetch<ApiBibleResponse<ApiBibleChapter[]>>(
    `/bibles/${bibleId}/books/${bookId}/chapters`
  )

  return (response.data ?? [])
    .map((chapter) => {
      const numberValue = Number(chapter.number)
      if (!Number.isFinite(numberValue)) {
        return null
      }
      return {
        id: chapter.id,
        number: numberValue,
        reference: chapter.reference,
      }
    })
    .filter((chapter): chapter is BibleChapter => chapter !== null)
}

export async function getChapterText(
  input: { chapterId: string; bookId?: string } | { bookId: string; chapterNumber: number }
): Promise<BibleChapterContent> {
  const { bibleId } = getBibleEnv()
  let chapterId: string
  let bookId = "bookId" in input ? input.bookId : undefined
  let chapterNumber: number | undefined

  if ("chapterId" in input) {
    chapterId = input.chapterId
  } else {
    chapterNumber = input.chapterNumber
    const chapters = await listChapters(input.bookId)
    const match = chapters.find((chapter) => chapter.number === input.chapterNumber)
    if (!match) {
      throw new Error(`Chapter ${input.chapterNumber} not found for book ${input.bookId}`)
    }
    chapterId = match.id
  }

  const response = await bibleFetch<ApiBibleResponse<ApiBibleChapterContent>>(
    `/bibles/${bibleId}/chapters/${chapterId}`,
    {
      "content-type": "html",
      "include-verse-numbers": true,
      "include-verse-spans": true,
      "include-notes": false,
      "include-titles": true,
      "include-chapter-numbers": false,
    }
  )

  const data = response.data
  const resolvedBookId = data.bookId ?? bookId ?? ""
  const resolvedNumber = Number(data.number ?? chapterNumber ?? NaN)

  return {
    id: data.id,
    bookId: resolvedBookId,
    number: Number.isFinite(resolvedNumber) ? resolvedNumber : chapterNumber ?? 0,
    reference: data.reference,
    content: data.content,
  }
}

export async function getChapterVerses(
  input: { chapterId: string; bookId?: string } | { bookId: string; chapterNumber: number }
): Promise<{ chapter: BibleChapterContent; verses: BibleVerse[] }> {
  const chapter = await getChapterText(input)
  const sanitized = sanitizeChapterHtml(chapter.content)
  const verses = parseChapterHtmlToVerses(sanitized)
  return { chapter: { ...chapter, content: sanitized }, verses }
}

export async function getBooksWithSlugs(): Promise<BibleBook[]> {
  const now = Date.now()
  if (cachedBooks && now - cachedBooksAt < BIBLE_CACHE_SECONDS * 1000) {
    return cachedBooks
  }

  const books = await listBooks()
  const mapped = books.map((book) => ({
    id: book.id,
    name: book.name,
    nameLong: book.nameLong,
    abbreviation: book.abbreviation,
    slug: slugifyBookName(book.name),
    testament: getBookTestament(book.id),
  }))

  cachedBooks = mapped
  cachedBooksAt = now

  return mapped
}

export async function getBookBySlug(slug: string): Promise<BibleBook | null> {
  const books = await getBooksWithSlugs()
  return books.find((book) => book.slug === slug) ?? null
}

export async function getBooksByTestament(): Promise<{
  oldTestament: BibleBook[]
  newTestament: BibleBook[]
  other: BibleBook[]
}> {
  const books = await getBooksWithSlugs()
  const oldTestament: BibleBook[] = []
  const newTestament: BibleBook[] = []
  const other: BibleBook[] = []

  for (const book of books) {
    if (book.testament === "old") {
      oldTestament.push(book)
    } else if (book.testament === "new") {
      newTestament.push(book)
    } else {
      other.push(book)
    }
  }

  return { oldTestament, newTestament, other }
}
