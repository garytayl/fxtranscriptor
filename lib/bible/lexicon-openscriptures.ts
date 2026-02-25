/**
 * Lazy-load full Strong's dictionaries from OpenScriptures (CC-BY-SA).
 * Tries jsDelivr first, then raw GitHub as fallback. Data: public domain (Strong 1890).
 */

import type { StrongsEntry } from "./lexicon-types"
import { normalizeStrongsCode } from "./lexicon-types"
import { lexiconLog } from "./lexicon-log"

const JSDELIVR_BASE = "https://cdn.jsdelivr.net/gh/openscriptures/strongs@master"
const RAW_GITHUB_BASE = "https://raw.githubusercontent.com/openscriptures/strongs/master"

/** Timeout for fetching the full dictionary (large file in serverless). */
const FETCH_TIMEOUT_MS = 45_000

type RawGreek = {
  lemma?: string
  translit?: string
  kjv_def?: string
  strongs_def?: string
  derivation?: string
}

type RawHebrew = {
  lemma?: string
  xlit?: string
  pron?: string
  kjv_def?: string
  strongs_def?: string
  derivation?: string
}

let greekCache: Record<string, RawGreek> | null = null
let hebrewCache: Record<string, RawHebrew> | null = null

async function fetchWithTimeout(url: string): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/javascript, text/plain, */*" },
    })
    clearTimeout(timeoutId)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.text()
  } catch (e) {
    clearTimeout(timeoutId)
    throw e
  }
}

/** Extract the JSON object from the .js file (var strongsXDictionary = {...};). */
function extractJsonFromJs(text: string): string {
  const trimmed = text.replace(/^\uFEFF/, "").trim()
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON object in response")
  return trimmed.slice(start, end + 1)
}

async function fetchUrlWithFallback(path: string): Promise<string> {
  const urls = [
    `${JSDELIVR_BASE}/${path}`,
    `${RAW_GITHUB_BASE}/${path}`,
  ]
  let lastError: Error | null = null
  for (const url of urls) {
    lexiconLog.fetchAttempt(url)
    try {
      const text = await fetchWithTimeout(url)
      return text
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      lexiconLog.fetchFail(url, e)
    }
  }
  lexiconLog.fetchAllFailed(path, lastError)
  throw lastError ?? new Error("Failed to fetch dictionary")
}

async function fetchGreekDictionary(): Promise<Record<string, RawGreek>> {
  if (greekCache) return greekCache
  try {
    const text = await fetchUrlWithFallback("greek/strongs-greek-dictionary.js")
    const jsonStr = extractJsonFromJs(text)
    greekCache = JSON.parse(jsonStr) as Record<string, RawGreek>
    const count = Object.keys(greekCache).length
    lexiconLog.dictLoaded("greek", count, "OpenScriptures")
    return greekCache
  } catch (e) {
    lexiconLog.parseFail("greek/strongs-greek-dictionary.js", e)
    throw e
  }
}

async function fetchHebrewDictionary(): Promise<Record<string, RawHebrew>> {
  if (hebrewCache) return hebrewCache
  try {
    const text = await fetchUrlWithFallback("hebrew/strongs-hebrew-dictionary.js")
    const jsonStr = extractJsonFromJs(text)
    hebrewCache = JSON.parse(jsonStr) as Record<string, RawHebrew>
    const count = Object.keys(hebrewCache).length
    lexiconLog.dictLoaded("hebrew", count, "OpenScriptures")
    return hebrewCache
  } catch (e) {
    lexiconLog.parseFail("hebrew/strongs-hebrew-dictionary.js", e)
    throw e
  }
}

function mapGreek(code: string, raw: RawGreek): StrongsEntry {
  return {
    code,
    lemma: raw.lemma ?? "",
    transliteration: raw.translit,
    pronunciation: undefined,
    meaning: raw.kjv_def?.trim() ?? "",
    definition: raw.strongs_def?.trim(),
    language: "greek",
  }
}

function mapHebrew(code: string, raw: RawHebrew): StrongsEntry {
  return {
    code,
    lemma: raw.lemma ?? "",
    transliteration: raw.xlit,
    pronunciation: raw.pron,
    meaning: raw.kjv_def?.trim() ?? "",
    definition: raw.strongs_def?.trim(),
    language: "hebrew",
  }
}

/**
 * Fetch a Strong's entry from OpenScriptures (lazy-loads full dictionary by language).
 * Returns null if code is invalid or not found.
 */
export async function getStrongsFromOpenScriptures(
  code: string
): Promise<StrongsEntry | null> {
  const normalized = normalizeStrongsCode(code)
  if (!normalized) {
    lexiconLog.invalidCode(code)
    return null
  }

  const isGreek = normalized.startsWith("G")
  try {
    if (isGreek) {
      const dict = await fetchGreekDictionary()
      const raw = dict[normalized]
      if (!raw) {
        lexiconLog.codeNotFound(normalized, "greek")
        return null
      }
      return mapGreek(normalized, raw)
    } else {
      const dict = await fetchHebrewDictionary()
      const raw = dict[normalized]
      if (!raw) {
        lexiconLog.codeNotFound(normalized, "hebrew")
        return null
      }
      return mapHebrew(normalized, raw)
    }
  } catch (e) {
    lexiconLog.lookupError(normalized, e)
    return null
  }
}
