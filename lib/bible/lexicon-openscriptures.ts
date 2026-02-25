/**
 * Lazy-load full Strong's dictionaries from OpenScriptures (CC-BY-SA) via jsDelivr.
 * Used when a code is not in the local LEXICON_SAMPLE. Data: public domain (Strong 1890).
 */

import type { StrongsEntry } from "./lexicon-types"
import { normalizeStrongsCode } from "./lexicon-types"

const OPEN_SCRIPTURES_BASE =
  "https://cdn.jsdelivr.net/gh/openscriptures/strongs@master"

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

async function fetchGreekDictionary(): Promise<Record<string, RawGreek>> {
  if (greekCache) return greekCache
  const url = `${OPEN_SCRIPTURES_BASE}/greek/strongs-greek-dictionary.js`
  const text = await fetchWithTimeout(url)
  const jsonStr = text
    .replace(/^var strongsGreekDictionary\s*=\s*/i, "")
    .replace(/;\s*$/, "")
  greekCache = JSON.parse(jsonStr) as Record<string, RawGreek>
  return greekCache
}

async function fetchHebrewDictionary(): Promise<Record<string, RawHebrew>> {
  if (hebrewCache) return hebrewCache
  const url = `${OPEN_SCRIPTURES_BASE}/hebrew/strongs-hebrew-dictionary.js`
  const text = await fetchWithTimeout(url)
  const jsonStr = text
    .replace(/^var strongsHebrewDictionary\s*=\s*/i, "")
    .replace(/;\s*$/, "")
  hebrewCache = JSON.parse(jsonStr) as Record<string, RawHebrew>
  return hebrewCache
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
  if (!normalized) return null

  const isGreek = normalized.startsWith("G")
  try {
    if (isGreek) {
      const dict = await fetchGreekDictionary()
      const raw = dict[normalized]
      if (!raw) return null
      return mapGreek(normalized, raw)
    } else {
      const dict = await fetchHebrewDictionary()
      const raw = dict[normalized]
      if (!raw) return null
      return mapHebrew(normalized, raw)
    }
  } catch {
    return null
  }
}
