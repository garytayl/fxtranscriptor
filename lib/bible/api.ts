import "server-only"

import { getBookTestament } from "@/lib/bible/constants"
import {
  getLocalHcsbBookBySlug,
  getLocalHcsbBooks,
  getLocalHcsbChapterVerses,
  getLocalHcsbChapters,
  LOCAL_HCSB_BIBLE_ID,
} from "@/lib/bible/local-hcsb"
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

/** For routes that only need key + base URL (e.g. listing bibles). Does not require bibleId. */
function getBibleApiKeyAndBaseUrl(): { apiKey: string; baseUrl: string } {
  const apiKey = process.env.API_BIBLE_KEY
  const baseUrlRaw = process.env.API_BIBLE_BASE_URL || DEFAULT_BASE_URL
  if (!apiKey) throw new Error("Missing required environment variable: API_BIBLE_KEY")
  const trimmedBaseUrl = baseUrlRaw.replace(/\/$/, "")
  const baseUrl = trimmedBaseUrl.endsWith("/v1") ? trimmedBaseUrl : `${trimmedBaseUrl}/v1`
  return { apiKey: apiKey as string, baseUrl }
}

function getBibleEnv(): { apiKey: string; bibleId: string; baseUrl: string } {
  const { apiKey, baseUrl } = getBibleApiKeyAndBaseUrl()
  const bibleId = process.env.API_BIBLE_BIBLE_ID || getDefaultBibleId()
  if (!bibleId) throw new Error("Missing required environment variable: API_BIBLE_BIBLE_ID (or set API_BIBLE_BSB_ID and API_BIBLE_WEBU_ID)")
  return { apiKey, bibleId: bibleId as string, baseUrl }
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
    const hint = response.status === 403 ? ` (bible in path: ${path}) — use GET /api/bible/bibles to see IDs your key can access` : ""
    throw new Error(`API.Bible error ${response.status}: ${errorText || response.statusText}${hint}`)
  }

  return (await response.json()) as T
}

function resolveBibleId(bibleId?: string) {
  const { bibleId: envBibleId } = getBibleEnv()
  return bibleId ?? envBibleId
}

/** List all bibles your API key can access. Use this to get exact IDs for API_BIBLE_BSB_ID / API_BIBLE_WEBU_ID. */
export async function listAllBibles(): Promise<{ id: string; name: string; abbreviation?: string }[]> {
  const { apiKey, baseUrl } = getBibleApiKeyAndBaseUrl()
  const response = await fetch(`${baseUrl}/bibles`, {
    headers: { "api-key": apiKey },
    next: { revalidate: BIBLE_CACHE_SECONDS },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`API.Bible error ${response.status}: ${text || response.statusText}`)
  }
  const json = (await response.json()) as ApiBibleResponse<Array<{ id: string; name: string; abbreviation?: string }>>
  return json.data ?? []
}

export async function listBooks(bibleId?: string): Promise<ApiBibleBook[]> {
  const resolvedBibleId = resolveBibleId(bibleId)
  const response = await bibleFetch<ApiBibleResponse<ApiBibleBook[]>>(`/bibles/${resolvedBibleId}/books`)
  return response.data ?? []
}

export async function getBibleInfo(bibleId?: string): Promise<ApiBibleInfo | null> {
  const resolvedBibleId = resolveBibleId(bibleId)
  if (resolvedBibleId === LOCAL_HCSB_BIBLE_ID) {
    return { id: LOCAL_HCSB_BIBLE_ID, name: "HCSB", abbreviation: "HCSB" }
  }
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
  if (resolvedBibleId === LOCAL_HCSB_BIBLE_ID) {
    return getLocalHcsbChapters(bookId)
  }
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
  let bookId: string
  let chapterNumber: number

  if (resolvedBibleId === LOCAL_HCSB_BIBLE_ID) {
    if ("chapterNumber" in input) {
      bookId = input.bookId
      chapterNumber = input.chapterNumber
    } else {
      const match = input.chapterId.match(/^([A-Z0-9]+)-(\d+)$/)
      if (!match) throw new Error(`Invalid chapter id for local HCSB: ${input.chapterId}`)
      bookId = match[1]
      chapterNumber = parseInt(match[2], 10)
    }
    const result = await getLocalHcsbChapterVerses(bookId, chapterNumber)
    const chapterId = "chapterId" in input ? input.chapterId : `${bookId}-${chapterNumber}`
    return {
      id: chapterId,
      bookId,
      number: chapterNumber,
      reference: result.reference,
      content: result.verses.map((v) => `<p class="v"><span class="v">${v.number}</span> ${escapeHtml(v.text)}</p>`).join("\n"),
    }
  }

  let chapterId: string
  let bookIdOpt = "bookId" in input ? input.bookId : undefined

  if ("chapterId" in input) {
    chapterId = input.chapterId
  } else {
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
  const resolvedBookId = data.bookId ?? bookIdOpt ?? ""
  const resolvedNumber = Number(data.number ?? ("chapterNumber" in input ? input.chapterNumber : undefined) ?? NaN)

  return {
    id: data.id,
    bookId: resolvedBookId,
    number: Number.isFinite(resolvedNumber) ? resolvedNumber : ("chapterNumber" in input ? input.chapterNumber : 0) ?? 0,
    reference: data.reference,
    content: data.content,
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export async function getChapterVerses(
  input: { chapterId: string; bookId?: string } | { bookId: string; chapterNumber: number },
  bibleId?: string
): Promise<{ chapter: BibleChapterContent; verses: BibleVerse[] }> {
  const resolvedBibleId = resolveBibleId(bibleId)
  if (resolvedBibleId === LOCAL_HCSB_BIBLE_ID) {
    let bookId: string
    let chapterNumber: number
    if ("chapterNumber" in input) {
      bookId = input.bookId
      chapterNumber = input.chapterNumber
    } else {
      const match = input.chapterId.match(/^([A-Z0-9]+)-(\d+)$/)
      if (!match) throw new Error(`Invalid chapter id for local HCSB: ${input.chapterId}`)
      bookId = match[1]
      chapterNumber = parseInt(match[2], 10)
    }
    const result = await getLocalHcsbChapterVerses(bookId, chapterNumber)
    const chapterId = "chapterId" in input ? input.chapterId : `${bookId}-${chapterNumber}`
    const book = BIBLE_BOOKS_WITH_CHAPTER_COUNTS.find((b) => b.id === bookId)
    return {
      chapter: {
        id: chapterId,
        bookId,
        number: chapterNumber,
        reference: result.reference,
        content: "",
      },
      verses: result.verses,
    }
  }
  const chapter = await getChapterText(input, bibleId)
  const sanitized = sanitizeChapterHtml(chapter.content)
  const verses = parseChapterHtmlToVerses(sanitized)
  return { chapter: { ...chapter, content: sanitized }, verses }
}

export async function getBooksWithSlugs(bibleId?: string): Promise<BibleBook[]> {
  const resolvedBibleId = resolveBibleId(bibleId)
  if (resolvedBibleId === LOCAL_HCSB_BIBLE_ID) {
    return getLocalHcsbBooks()
  }
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

/** Alias slug -> canonical slug for API book lookup (e.g. scripture.api uses "Psalms" not "Psalm") */
const BOOK_SLUG_ALIASES: Record<string, string> = {
  psalm: "psalms",
}

function levenshtein(a: string, b: string): number {
  const an = a.length
  const bn = b.length
  const dp = Array.from({ length: an + 1 }, () => Array(bn + 1).fill(0))
  for (let i = 0; i <= an; i++) dp[i][0] = i
  for (let j = 0; j <= bn; j++) dp[0][j] = j
  for (let i = 1; i <= an; i++) {
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[an][bn]
}

export async function getBookBySlug(slug: string, bibleId?: string): Promise<BibleBook | null> {
  const resolvedBibleId = resolveBibleId(bibleId)
  if (resolvedBibleId === LOCAL_HCSB_BIBLE_ID) {
    return getLocalHcsbBookBySlug(slug)
  }
  const books = await getBooksWithSlugs(bibleId)
  const normalizedSlug = slug.toLowerCase().trim()
  const found = books.find((book) => book.slug === normalizedSlug) ?? null
  if (found) return found
  const canonical = BOOK_SLUG_ALIASES[normalizedSlug]
  if (canonical) return books.find((book) => book.slug === canonical) ?? null

  // Fuzzy: slug is prefix of exactly one book slug (e.g. "gen" -> "genesis"); avoid "jo" matching first of Job/John/Joshua
  const prefixMatches = books.filter((book) => book.slug.startsWith(normalizedSlug))
  if (prefixMatches.length === 1) return prefixMatches[0]

  // Fuzzy: typo – smallest Levenshtein distance, max 2 edits
  let best: BibleBook | null = null
  let bestDist = 3
  for (const book of books) {
    const d = levenshtein(normalizedSlug, book.slug)
    if (d < bestDist && (normalizedSlug.length <= 5 || d <= 2)) {
      bestDist = d
      best = book
    }
  }
  return best
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
