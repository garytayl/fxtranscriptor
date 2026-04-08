/**
 * Verse-level Strong's numbers from KJV+Strong's (kaiserlik/kjv) for hover-in-scripture.
 * Fetches book JSON from jsDelivr, parses "en" field (word[G1234] or word[H1234]) to ordered Strong's codes.
 */

import { jsonrepair } from "jsonrepair"

import { BIBLE_BOOKS_WITH_CHAPTER_COUNTS } from "@/lib/bible/constants"
import { slugifyBookName } from "@/lib/bible/reference"
import { fillTrailingPlainStrongs } from "@/lib/bible/strongs-tail-guess"
import { verseStrongsLog } from "@/lib/bible/verse-strongs-log"

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

/** `code` is empty when this segment has no Strong's tag (e.g. words before the tagged word in a phrase, or Kaiserlik text after the last `[G#]`). */
export type StrongsWordAndCode = { word: string; code: string }

/** Kaiserlik embeds `<em>…</em>` in `en`; strip before splitting multi-word spans. */
function stripKaiserlikMarkup(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

/**
 * Kaiserlik often puts several English words before one tag, e.g. `in[G1722] the daily[G2522]`.
 * Only the word immediately before `[G#]` is tagged; leading words in that span have no Strong's in the source.
 */
function expandRawToWordSegments(raw: string, code: string): StrongsWordAndCode[] {
  const cleaned = stripKaiserlikMarkup(raw)
  if (!cleaned) return []
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return [{ word: parts[0], code }]
  const out: StrongsWordAndCode[] = []
  for (let i = 0; i < parts.length - 1; i++) {
    out.push({ word: parts[i], code: "" })
  }
  out.push({ word: parts[parts.length - 1], code })
  return out
}

/**
 * Parse "en" to word+code pairs so the displayed text matches the Strong's codes (KJV wording).
 * Handles consecutive codes like "every man[G3956][G444]" by using a middle dot for the second code so the same word is not shown twice.
 * Splits multi-word spans before each tag so only the last word carries that Strong's number.
 * Appends text after the final `[G#]`/`[H#]` as plain word segments (`code: ""`).
 */
export function parseEnToWordsAndCodes(en: string): StrongsWordAndCode[] {
  const pairs: StrongsWordAndCode[] = []
  const regex = /\[([GH]\d+)\]/gi
  let lastIndex = 0
  let lastWord = ""
  let m: RegExpExecArray | null
  while ((m = regex.exec(en)) !== null) {
    const raw = en.slice(lastIndex, m.index)
    const code = normalizeCode(m[1])

    if (!raw.trim() && lastWord) {
      pairs.push({ word: "\u00b7", code })
      lastIndex = m.index + m[0].length
      continue
    }

    if (!raw.trim()) {
      const fallback = lastWord || code
      pairs.push({ word: fallback, code })
      lastWord = fallback
      lastIndex = m.index + m[0].length
      continue
    }

    const segments = expandRawToWordSegments(raw, code)
    if (segments.length === 0) {
      pairs.push({ word: code, code })
      lastWord = code
    } else {
      for (const seg of segments) {
        pairs.push(seg)
      }
      lastWord = segments[segments.length - 1]!.word
    }
    lastIndex = m.index + m[0].length
  }

  const afterLastTag = stripKaiserlikMarkup(en.slice(lastIndex))
  if (afterLastTag) {
    for (const w of afterLastTag.split(/\s+/).filter(Boolean)) {
      pairs.push({ word: w, code: "" })
    }
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

export type KaiserlikResolution = "slug" | "usfm_full" | "usfm_segment" | null

export type StrongsLoadTrace = {
  bookSlug: string
  apiBookId: string
  chapter: number
  resolvedStem: string | null
  resolutionVia: KaiserlikResolution
  fetchAttempts: { url: string; status: number; ok: boolean; error?: string }[]
  jsonTopKeys: string[]
  kjvCodeUsed: string | null
  chapterKey: string
  chapterFound: boolean
  sampleChapterKeys: string[]
  verseCount: number
  /** Actionable hints for operators (also logged server-side). */
  hints: string[]
}

/** How we mapped URL/API book to a Kaiserlik file stem (e.g. Jhn). */
export function resolveKaiserlikBookCodeDetailed(ref: KjvStrongsBookRef): {
  code: string | null
  via: KaiserlikResolution
} {
  const fromSlug = getKjvCodeFromSlug(ref.slug)
  if (fromSlug) return { code: fromSlug, via: "slug" }

  if (!ref.id?.trim()) return { code: null, via: null }

  const u = ref.id.trim().toUpperCase()
  if (USFM_TO_KAISERLIK[u]) return { code: USFM_TO_KAISERLIK[u], via: "usfm_full" }

  const parts = u.split(/[-_]/)
  for (let i = parts.length - 1; i >= 0; i--) {
    const seg = parts[i]
    if (seg && USFM_TO_KAISERLIK[seg]) {
      return { code: USFM_TO_KAISERLIK[seg], via: "usfm_segment" }
    }
  }
  return { code: null, via: null }
}

/** Resolve kaiserlik JSON stem (e.g. Jhn) from URL slug and/or API book id. */
export function resolveKaiserlikBookCode(ref: KjvStrongsBookRef): string | null {
  return resolveKaiserlikBookCodeDetailed(ref).code
}

async function fetchKaiserlikJson(
  ref: KjvStrongsBookRef,
  resolvedStem: string
): Promise<{ json: KaiserlikBook | null; attempts: StrongsLoadTrace["fetchAttempts"] }> {
  const attempts: StrongsLoadTrace["fetchAttempts"] = []
  const cached = bookCache.get(resolvedStem)
  if (cached) {
    verseStrongsLog.skipped(`using in-memory cache for ${resolvedStem}.json`)
    return { json: cached, attempts }
  }

  for (const base of KJV_FETCH_BASES) {
    const url = `${base}/${resolvedStem}.json`
    verseStrongsLog.fetchAttempt(url)
    try {
      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "User-Agent": "fxtranscriptor-scripture-reader/1.0",
        },
      })
      const ok = res.ok
      attempts.push({ url, status: res.status, ok })
      verseStrongsLog.fetchResponse(url, res.status, ok)
      if (!ok) continue

      const text = await res.text()
      let json: KaiserlikBook
      try {
        json = JSON.parse(text) as KaiserlikBook
      } catch (parseErr) {
        /** Kaiserlik embeds Spanish etc.; some files have broken string escaping. jsonrepair recovers enough for `en` keys. */
        try {
          json = JSON.parse(jsonrepair(text)) as KaiserlikBook
          verseStrongsLog.jsonRepaired(url)
        } catch {
          verseStrongsLog.jsonParseError(url, parseErr)
          attempts[attempts.length - 1]!.error = `JSON parse: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`
          continue
        }
      }

      bookCache.set(resolvedStem, json)
      return { json, attempts }
    } catch (err) {
      attempts.push({ url, status: 0, ok: false, error: err instanceof Error ? err.message : String(err) })
      verseStrongsLog.fetchThrow(url, err)
    }
  }

  const last = attempts[attempts.length - 1]
  verseStrongsLog.fetchExhausted(
    attempts.map((a) => a.url),
    last?.status ?? null,
  )
  return { json: null, attempts }
}

async function fetchBookJson(ref: KjvStrongsBookRef): Promise<KaiserlikBook | null> {
  const { code } = resolveKaiserlikBookCodeDetailed(ref)
  if (!code) return null
  const { json } = await fetchKaiserlikJson(ref, code)
  return json
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
    out[Number(verseNum)] = pairs.map((p) => p.code).filter((c) => c.length > 0)
  }
  return out
}

function emptyTrace(book: KjvStrongsBookRef, chapter: number, partial: Partial<StrongsLoadTrace> = {}): StrongsLoadTrace {
  return {
    bookSlug: book.slug,
    apiBookId: book.id,
    chapter,
    resolvedStem: null,
    resolutionVia: null,
    fetchAttempts: [],
    jsonTopKeys: [],
    kjvCodeUsed: null,
    chapterKey: "",
    chapterFound: false,
    sampleChapterKeys: [],
    verseCount: 0,
    hints: [],
    ...partial,
  }
}

/**
 * Load Strong's word data plus a diagnostic trace (used by {@link getStrongsWordsForChapter}; trace is not exposed in the app UI).
 */
export async function loadStrongsChapterWithTrace(
  book: KjvStrongsBookRef,
  chapter: number
): Promise<{ words: Record<number, StrongsWordAndCode[]>; trace: StrongsLoadTrace }> {
  const hints: string[] = []
  verseStrongsLog.resolveStart(book, chapter)

  const { code: resolvedStem, via: resolutionVia } = resolveKaiserlikBookCodeDetailed(book)
  const viaLog =
    resolutionVia === null ? "none" : resolutionVia === "slug" ? "slug" : resolutionVia === "usfm_full" ? "usfm_full" : "usfm_segment"
  verseStrongsLog.resolved(resolvedStem, viaLog)

  if (!resolvedStem) {
    hints.push(
      "Map this book: add the URL slug to SLUG_TO_KJV_CODE or ensure apiBookId matches USFM (GEN…REV) in USFM_TO_KAISERLIK.",
    )
    hints.push(`Current inputs: slug=${book.slug}, apiBookId=${book.id || "(empty)"}.`)
    return {
      words: {},
      trace: emptyTrace(book, chapter, {
        resolutionVia,
        hints,
      }),
    }
  }

  const { json, attempts } = await fetchKaiserlikJson(book, resolvedStem)

  if (!json) {
    hints.push("Kaiserlik JSON did not load from any CDN URL. Check server outbound HTTPS, jsDelivr/GitHub status, or firewall.")
    return {
      words: {},
      trace: emptyTrace(book, chapter, {
        resolvedStem,
        resolutionVia,
        fetchAttempts: attempts,
        hints,
      }),
    }
  }

  const topKeys = Object.keys(json)
  verseStrongsLog.jsonParsed(resolvedStem, topKeys)

  const kjvCode = resolvedStem
  const bookData = getBookData(json)
  if (!bookData) {
    verseStrongsLog.bookDataMissing(resolvedStem, topKeys)
    hints.push("JSON parsed but book container was empty — Kaiserlik file format may have changed.")
    return {
      words: {},
      trace: emptyTrace(book, chapter, {
        resolvedStem,
        resolutionVia,
        fetchAttempts: attempts,
        jsonTopKeys: topKeys,
        kjvCodeUsed: kjvCode,
        hints,
      }),
    }
  }

  const chapterKey = `${kjvCode}|${chapter}`
  const sampleChapterKeys = Object.keys(bookData).filter((k) => k.includes("|"))
  const chapterData = bookData[chapterKey]
  const chapterFound = !!(chapterData && typeof chapterData === "object")

  verseStrongsLog.chapterLookup(kjvCode, chapter, chapterKey, chapterFound, sampleChapterKeys)

  if (!chapterFound) {
    hints.push(
      `Expected chapter key "${chapterKey}" in Kaiserlik data. If chapter exists in the Bible, verify chapter number and file ${kjvCode}.json.`,
    )
    return {
      words: {},
      trace: emptyTrace(book, chapter, {
        resolvedStem,
        resolutionVia,
        fetchAttempts: attempts,
        jsonTopKeys: topKeys,
        kjvCodeUsed: kjvCode,
        chapterKey,
        chapterFound: false,
        sampleChapterKeys,
        hints,
      }),
    }
  }

  const out: Record<number, StrongsWordAndCode[]> = {}
  for (const [verseKey, verseObj] of Object.entries(chapterData)) {
    const lastPipe = verseKey.lastIndexOf("|")
    const verseNum = lastPipe >= 0 ? parseInt(verseKey.slice(lastPipe + 1), 10) : 0
    if (verseNum && verseObj?.en) {
      out[verseNum] = fillTrailingPlainStrongs(parseEnToWordsAndCodes(verseObj.en), book.id)
    }
  }

  const verseCount = Object.keys(out).length
  verseStrongsLog.versesLoaded(verseCount)

  if (verseCount === 0) {
    hints.push("Chapter object had no verses with `en` + Strong's tags — unexpected Kaiserlik shape for this chapter.")
  }

  return {
    words: out,
    trace: emptyTrace(book, chapter, {
      resolvedStem,
      resolutionVia,
      fetchAttempts: attempts,
      jsonTopKeys: topKeys,
      kjvCodeUsed: kjvCode,
      chapterKey,
      chapterFound: true,
      sampleChapterKeys,
      verseCount,
      hints,
    }),
  }
}

/**
 * Get KJV word + Strong's code per verse for a whole chapter.
 * Use this to render verse text so each word matches its Strong's code (avoids WEB/KJV index mismatch).
 */
export async function getStrongsWordsForChapter(
  book: KjvStrongsBookRef,
  chapter: number
): Promise<Record<number, StrongsWordAndCode[]>> {
  const { words } = await loadStrongsChapterWithTrace(book, chapter)
  return words
}
