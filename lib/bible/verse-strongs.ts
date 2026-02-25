/**
 * Verse-level Strong's numbers from KJV+Strong's (kaiserlik/kjv) for hover-in-scripture.
 * Fetches book JSON from jsDelivr, parses "en" field (word[G1234] or word[H1234]) to ordered Strong's codes.
 */

const KJV_BASE = "https://cdn.jsdelivr.net/gh/kaiserlik/kjv@main"

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

/** Parse "en" string like "In[G1722] the beginning[G746] was[G2258]" -> ["G1722","G746","G2258",...] */
function parseEnToStrongsOrder(en: string): string[] {
  const codes: string[] = []
  const regex = /\[([GH]\d+)\]/gi
  let m: RegExpExecArray | null
  while ((m = regex.exec(en)) !== null) {
    codes.push(m[1].toUpperCase().replace(/^G/, "G").replace(/^H/, "H"))
  }
  return codes
}

type KaiserlikVerse = { en?: string }
/** Chapter key (e.g. "Jhn|1") -> verse key (e.g. "Jhn|1|1") -> verse data */
type KaiserlikChapter = Record<string, KaiserlikVerse>
/** Book code (e.g. "Jhn") -> chapter key -> verse key -> verse data */
type KaiserlikBook = Record<string, Record<string, KaiserlikChapter>>

const bookCache = new Map<string, KaiserlikBook>()

function getKjvCode(bookSlug: string): string | null {
  const slug = bookSlug.toLowerCase().trim()
  return SLUG_TO_KJV_CODE[slug] ?? null
}

async function fetchBook(bookSlug: string): Promise<KaiserlikBook | null> {
  const code = getKjvCode(bookSlug)
  if (!code) return null
  const cached = bookCache.get(bookSlug)
  if (cached) return cached
  const url = `${KJV_BASE}/${code}.json`
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } })
    if (!res.ok) return null
    const json = (await res.json()) as KaiserlikBook
    bookCache.set(bookSlug, json)
    return json
  } catch {
    return null
  }
}

/**
 * Get Strong's codes in word order for one verse (KJV alignment).
 * Returns empty array if book/verse not found or not in KJV.
 */
export async function getStrongsForVerse(
  bookSlug: string,
  chapter: number,
  verse: number
): Promise<string[]> {
  const book = await fetchBook(bookSlug)
  if (!book) return []
  const kjvCode = getKjvCode(bookSlug)
  if (!kjvCode) return []
  const bookData = book[kjvCode]
  if (!bookData || typeof bookData !== "object") return []
  const chapterKey = `${kjvCode}|${chapter}`
  const chapterData = bookData[chapterKey]
  if (!chapterData || typeof chapterData !== "object") return []
  const verseKey = `${kjvCode}|${chapter}|${verse}`
  const verseData = (chapterData as Record<string, KaiserlikVerse>)[verseKey]
  if (!verseData?.en) return []
  return parseEnToStrongsOrder(verseData.en)
}

/**
 * Get Strong's per verse for a whole chapter. Keys are verse numbers (1-based).
 */
export async function getStrongsForChapter(
  bookSlug: string,
  chapter: number
): Promise<Record<number, string[]>> {
  const book = await fetchBook(bookSlug)
  if (!book) return {}
  const kjvCode = getKjvCode(bookSlug)
  if (!kjvCode) return {}
  const bookData = book[kjvCode]
  if (!bookData || typeof bookData !== "object") return {}
  const chapterKey = `${kjvCode}|${chapter}`
  const chapterData = bookData[chapterKey]
  if (!chapterData || typeof chapterData !== "object") return {}
  const out: Record<number, string[]> = {}
  for (const [verseKey, verseObj] of Object.entries(chapterData)) {
    const lastPipe = verseKey.lastIndexOf("|")
    const verseNum = lastPipe >= 0 ? parseInt(verseKey.slice(lastPipe + 1), 10) : 0
    if (verseNum && verseObj?.en) {
      out[verseNum] = parseEnToStrongsOrder(verseObj.en)
    }
  }
  return out
}
