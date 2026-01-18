import "server-only"

import { getBookTestament } from "@/lib/bible/constants"
import { parseChapterHtmlToVerses, sanitizeChapterHtml } from "@/lib/bible/parse"
import { slugifyBookName } from "@/lib/bible/reference"
import { getDefaultBibleId } from "@/lib/bible/translations"
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

type ApiBibleInfo = {
  id: string
  name: string
  description?: string
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

const cachedBooks = new Map<string, { books: BibleBook[]; cachedAt: number }>()
const cachedBibleInfo = new Map<string, { info: ApiBibleInfo; cachedAt: number }>()

function getBibleEnv(): { apiKey: string; bibleId: string; baseUrl: string } {
  const apiKey = process.env.API_BIBLE_KEY
  const bibleId = process.env.API_BIBLE_BIBLE_ID || getDefaultBibleId()
  const baseUrlRaw = process.env.API_BIBLE_BASE_URL || DEFAULT_BASE_URL

  const missing = []
  if (!apiKey) missing.push("API_BIBLE_KEY")
  if (!bibleId) missing.push("API_BIBLE_BIBLE_ID")
  if (!baseUrlRaw) missing.push("API_BIBLE_BASE_URL")

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`)
  }

  const trimmedBaseUrl = baseUrlRaw.replace(/\/$/, "")
  const baseUrl = trimmedBaseUrl.endsWith("/v1") ? trimmedBaseUrl : `${trimmedBaseUrl}/v1`

  return {
    apiKey: apiKey as string,
    bibleId: bibleId as string,
    baseUrl,
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

function resolveBibleId(bibleId?: string) {
  const { bibleId: envBibleId } = getBibleEnv()
  return bibleId ?? envBibleId
}

export async function listBooks(bibleId?: string): Promise<ApiBibleBook[]> {
  const resolvedBibleId = resolveBibleId(bibleId)
  const response = await bibleFetch<ApiBibleResponse<ApiBibleBook[]>>(`/bibles/${resolvedBibleId}/books`)
  return response.data ?? []
}

export async function getBibleInfo(bibleId?: string): Promise<ApiBibleInfo | null> {
  const resolvedBibleId = resolveBibleId(bibleId)
  const now = Date.now()
  const cached = cachedBibleInfo.get(resolvedBibleId)
  if (cached && now - cached.cachedAt < BIBLE_CACHE_SECONDS * 1000) {
    return cached.info
  }

  const response = await bibleFetch<ApiBibleResponse<ApiBibleInfo>>(`/bibles/${resolvedBibleId}`)
  if (!response.data) {
    return null
  }
  cachedBibleInfo.set(resolvedBibleId, { info: response.data, cachedAt: now })
  return response.data
}

export async function listChapters(bookId: string, bibleId?: string): Promise<BibleChapter[]> {
  const resolvedBibleId = resolveBibleId(bibleId)
  const response = await bibleFetch<ApiBibleResponse<ApiBibleChapter[]>>(
    `/bibles/${resolvedBibleId}/books/${bookId}/chapters`
  )

  return (response.data ?? []).reduce<BibleChapter[]>((acc, chapter) => {
    const numberValue = Number(chapter.number)
    if (!Number.isFinite(numberValue)) {
      return acc
    }
    acc.push({
      id: chapter.id,
      number: numberValue,
      reference: chapter.reference,
    })
    return acc
  }, [])
}

export async function getChapterText(
  input: { chapterId: string; bookId?: string } | { bookId: string; chapterNumber: number },
  bibleId?: string
): Promise<BibleChapterContent> {
  const resolvedBibleId = resolveBibleId(bibleId)
  let chapterId: string
  let bookId = "bookId" in input ? input.bookId : undefined
  let chapterNumber: number | undefined

  if ("chapterId" in input) {
    chapterId = input.chapterId
  } else {
    chapterNumber = input.chapterNumber
    const chapters = await listChapters(input.bookId, resolvedBibleId)
    const match = chapters.find((chapter) => chapter.number === input.chapterNumber)
    if (!match) {
      throw new Error(`Chapter ${input.chapterNumber} not found for book ${input.bookId}`)
    }
    chapterId = match.id
  }

  const response = await bibleFetch<ApiBibleResponse<ApiBibleChapterContent>>(
    `/bibles/${resolvedBibleId}/chapters/${chapterId}`,
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
  input: { chapterId: string; bookId?: string } | { bookId: string; chapterNumber: number },
  bibleId?: string
): Promise<{ chapter: BibleChapterContent; verses: BibleVerse[] }> {
  const chapter = await getChapterText(input, bibleId)
  const sanitized = sanitizeChapterHtml(chapter.content)
  const verses = parseChapterHtmlToVerses(sanitized)
  return { chapter: { ...chapter, content: sanitized }, verses }
}

export async function getBooksWithSlugs(bibleId?: string): Promise<BibleBook[]> {
  const resolvedBibleId = resolveBibleId(bibleId)
  const now = Date.now()
  const cached = cachedBooks.get(resolvedBibleId)
  if (cached && now - cached.cachedAt < BIBLE_CACHE_SECONDS * 1000) {
    return cached.books
  }

  const books = await listBooks(resolvedBibleId)
  const mapped = books.map((book) => ({
    id: book.id,
    name: book.name,
    nameLong: book.nameLong,
    abbreviation: book.abbreviation,
    slug: slugifyBookName(book.name),
    testament: getBookTestament(book.id),
  }))

  cachedBooks.set(resolvedBibleId, { books: mapped, cachedAt: now })

  return mapped
}

export async function getBookBySlug(slug: string, bibleId?: string): Promise<BibleBook | null> {
  const books = await getBooksWithSlugs(bibleId)
  return books.find((book) => book.slug === slug) ?? null
}

export async function getBooksByTestament(): Promise<{
  oldTestament: BibleBook[]
  newTestament: BibleBook[]
  other: BibleBook[]
}> {
  const books = await getBooksWithSlugs()
  return groupBooksByTestament(books)
}

export async function getBooksByTestamentWithId(bibleId?: string): Promise<{
  oldTestament: BibleBook[]
  newTestament: BibleBook[]
  other: BibleBook[]
}> {
  const books = await getBooksWithSlugs(bibleId)
  return groupBooksByTestament(books)
}

function groupBooksByTestament(books: BibleBook[]) {
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
