/**
 * Verse-level Strong's numbers from KJV+Strong's (kaiserlik/kjv) for hover-in-scripture.
 * Fetches book JSON from jsDelivr, parses "en" field (word[G1234] or word[H1234]) to ordered Strong's codes.
 */

import { BIBLE_BOOKS_WITH_CHAPTER_COUNTS } from "@/lib/bible/constants"
import { slugifyBookName } from "@/lib/bible/reference"

const KJV_FETCH_BASES = [
  "https://cdn.jsdelivr.net/gh/kaiserlik/kjv@main",
  "https://raw.githubusercontent.com/kaiserlik/kjv/main",
]

/** Our book slug (from API.Bible/slugifyBookName) -> kaiserlik book code (e.g. Jhn, 1Jo, Gen) */
const SLUG_TO_KJV_CODE: Record<string, string> = {
  genesis: "Gen",
  exodus: "Exo",
  leviticus: "Lev",
  numbers: "Num",
  deuteronomy: "Deu",
  joshua: "Jos",
  judges: "Jdg",
  ruth: "Rut",
  "1-samuel": "1Sa",
  "2-samuel": "2Sa",
  "1-kings": "1Ki",
  "2-kings": "2Ki",
  "1-chronicles": "1Ch",
  "2-chronicles": "2Ch",
  ezra: "Ezr",
  nehemiah: "Neh",
  esther: "Est",
  job: "Job",
  psalms: "Psa",
  proverbs: "Pro",
  ecclesiastes: "Ecc",
  "song-of-solomon": "Sng",
  isaiah: "Isa",
  jeremiah: "Jer",
  lamentations: "Lam",
  ezekiel: "Eze",
  daniel: "Dan",
  hosea: "Hos",
  joel: "Joe",
  amos: "Amo",
  obadiah: "Oba",
  jonah: "Jon",
  micah: "Mic",
  nahum: "Nah",
  habakkuk: "Hab",
  zephaniah: "Zep",
  haggai: "Hag",
  zechariah: "Zec",
  malachi: "Mal",
  matthew: "Mat",
  mark: "Mar",
  luke: "Luk",
  john: "Jhn",
  acts: "Act",
  romans: "Rom",
  "1-corinthians": "1Co",
  "2-corinthians": "2Co",
  galatians: "Gal",
  ephesians: "Eph",
  philippians: "Php",
  colossians: "Col",
  "1-thessalonians": "1Th",
  "2-thessalonians": "2Th",
  "1-timothy": "1Ti",
  "2-timothy": "2Ti",
  titus: "Tit",
  philemon: "Phm",
  hebrews: "Heb",
  james: "Jas",
  "1-peter": "1Pe",
  "2-peter": "2Pe",
  "1-john": "1Jo",
  "2-john": "2Jo",
  "3-john": "3Jo",
  jude: "Jde",
  revelation: "Rev",
}

/** Map API.Bible USFM book id (e.g. JHN) -> kaiserlik file stem (e.g. Jhn). Fills gaps when slugify yields a slug we do not list. */
const USFM_TO_KAISERLIK: Record<string, string> = (() => {
  const m: Record<string, string> = {}
  for (const b of BIBLE_BOOKS_WITH_CHAPTER_COUNTS) {
    const slug = slugifyBookName(b.name)
    const code = SLUG_TO_KJV_CODE[slug]
    if (code) m[b.id] = code
  }
  return m
})()

export type KjvStrongsBookRef = {
  slug: string
  /** USFM-style id from API.Bible (e.g. JHN, GEN). Used when slug does not match our map. */
  id: string
}

/** Normalize Strong's code to canonical form (e.g. "g26" -> "G26"). */
function normalizeCode(code: string): string {
  const c = code.toUpperCase()
  return c.startsWith("G") || c.startsWith("H") ? c : code
}

/** Parse "en" string like "In[G1722] the beginning[G746] was[G2258]" -> ["G1722","G746","G2258",...] */
function parseEnToStrongsOrder(en: string): string[] {
  const codes: string[] = []
  const regex = /\[([GH]\d+)\]/gi
  let m: RegExpExecArray | null
  while ((m = regex.exec(en)) !== null) {
    codes.push(normalizeCode(m[1]))
  }
  return codes
}

export type StrongsWordAndCode = { word: string; code: string }

/**
 * Parse "en" to word+code pairs so the displayed text matches the Strong's codes (KJV wording).
 * Handles consecutive codes like "every man[G3956][G444]" by using a zero-width space for the second code so the same word is not shown twice.
 */
export function parseEnToWordsAndCodes(en: string): StrongsWordAndCode[] {
  const pairs: StrongsWordAndCode[] = []
  const regex = /\[([GH]\d+)\]/gi
  let lastIndex = 0
  let lastWord = ""
  let m: RegExpExecArray | null
  while ((m = regex.exec(en)) !== null) {
    const raw = en.slice(lastIndex, m.index).trim()
    const code = normalizeCode(m[1])
    const displayWord = raw || lastWord || code
    if (!raw && lastWord) {
      pairs.push({ word: "\u00b7", code })
    } else {
      pairs.push({ word: displayWord, code })
    }
    lastWord = displayWord
    lastIndex = m.index + m[0].length
  }
  return pairs
}

type KaiserlikVerse = { en?: string }
/** Chapter key (e.g. "Jhn|1") -> verse key (e.g. "Jhn|1|1") -> verse data */
type KaiserlikChapter = Record<string, KaiserlikVerse>
/** Book code (e.g. "Jhn") -> chapter key -> verse key -> verse data */
type KaiserlikBook = Record<string, Record<string, KaiserlikChapter>>

const bookCache = new Map<string, KaiserlikBook>()

/** Same idea as API book slug aliases — API.Bible may use a slug we do not list verbatim. */
const SLUG_ALIASES_FOR_KAISERLIK: Record<string, string> = {
  psalm: "psalms",
  "song-of-songs": "song-of-solomon",
}

function getKjvCodeFromSlug(bookSlug: string): string | null {
  const slug = bookSlug.toLowerCase().trim()
  const mapped = SLUG_ALIASES_FOR_KAISERLIK[slug] ?? slug
  return SLUG_TO_KJV_CODE[mapped] ?? null
}

/** Resolve kaiserlik JSON stem (e.g. Jhn) from URL slug and/or API book id. */
export function resolveKaiserlikBookCode(ref: KjvStrongsBookRef): string | null {
  const fromSlug = getKjvCodeFromSlug(ref.slug)
  if (fromSlug) return fromSlug
  const usfm = ref.id?.trim().toUpperCase()
  if (usfm && USFM_TO_KAISERLIK[usfm]) return USFM_TO_KAISERLIK[usfm]
  return null
}

async function fetchBookJson(ref: KjvStrongsBookRef): Promise<KaiserlikBook | null> {
  const code = resolveKaiserlikBookCode(ref)
  if (!code) return null
  const cached = bookCache.get(code)
  if (cached) return cached
  for (const base of KJV_FETCH_BASES) {
    const url = `${base}/${code}.json`
    try {
      const res = await fetch(url, { next: { revalidate: 86400 } })
      if (!res.ok) continue
      const json = (await res.json()) as KaiserlikBook
      bookCache.set(code, json)
      return json
    } catch {
      continue
    }
  }
  return null
}

/**
 * Get Strong's codes in word order for one verse (KJV alignment).
 * Returns empty array if book/verse not found or not in KJV.
 */
export async function getStrongsForVerse(
  book: KjvStrongsBookRef,
  chapter: number,
  verse: number
): Promise<string[]> {
  const json = await fetchBookJson(book)
  if (!json) return []
  const kjvCode = resolveKaiserlikBookCode(book)
  if (!kjvCode) return []
  const bookData = getBookData(json)
  if (!bookData) return []
  const chapterKey = `${kjvCode}|${chapter}`
  const chapterData = bookData[chapterKey]
  if (!chapterData || typeof chapterData !== "object") return []
  const verseKey = `${kjvCode}|${chapter}|${verse}`
  const verseData = (chapterData as Record<string, KaiserlikVerse>)[verseKey]
  if (!verseData?.en) return []
  return parseEnToStrongsOrder(verseData.en)
}

/** Kaiserlik JSON has one top-level key per book; numbered books use full name (e.g. "1 Samuel"), others use code (e.g. "Jhn"). */
function getBookData(book: KaiserlikBook): Record<string, KaiserlikChapter> | null {
  const keys = Object.keys(book)
  if (keys.length === 0) return null
  const data = book[keys[0]]
  return data && typeof data === "object" ? (data as Record<string, KaiserlikChapter>) : null
}

/**
 * Get Strong's per verse for a whole chapter. Keys are verse numbers (1-based).
 */
export async function getStrongsForChapter(
  book: KjvStrongsBookRef,
  chapter: number
): Promise<Record<number, string[]>> {
  const words = await getStrongsWordsForChapter(book, chapter)
  const out: Record<number, string[]> = {}
  for (const [verseNum, pairs] of Object.entries(words)) {
    out[Number(verseNum)] = pairs.map((p) => p.code)
  }
  return out
}

/**
 * Get KJV word + Strong's code per verse for a whole chapter.
 * Use this to render verse text so each word matches its Strong's code (avoids WEB/KJV index mismatch).
 */
export async function getStrongsWordsForChapter(
  book: KjvStrongsBookRef,
  chapter: number
): Promise<Record<number, StrongsWordAndCode[]>> {
  const json = await fetchBookJson(book)
  if (!json) return {}
  const kjvCode = resolveKaiserlikBookCode(book)
  if (!kjvCode) return {}
  const bookData = getBookData(json)
  if (!bookData) return {}
  const chapterKey = `${kjvCode}|${chapter}`
  const chapterData = bookData[chapterKey]
  if (!chapterData || typeof chapterData !== "object") return {}
  const out: Record<number, StrongsWordAndCode[]> = {}
  for (const [verseKey, verseObj] of Object.entries(chapterData)) {
    const lastPipe = verseKey.lastIndexOf("|")
    const verseNum = lastPipe >= 0 ? parseInt(verseKey.slice(lastPipe + 1), 10) : 0
    if (verseNum && verseObj?.en) {
      out[verseNum] = parseEnToWordsAndCodes(verseObj.en)
    }
  }
  return out
}
