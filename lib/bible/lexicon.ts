/**
 * Greek/Hebrew word study (Strong's) lexicon access.
 * Uses local sample first, then full OpenScriptures dictionaries (lazy-loaded via CDN).
 */

import { normalizeStrongsCode } from "./lexicon-types"
import { LEXICON_SAMPLE } from "./lexicon-data"
import { getStrongsFromOpenScriptures } from "./lexicon-openscriptures"
import type { StrongsEntry } from "./lexicon-types"

export type { StrongsEntry, StrongsLanguage } from "./lexicon-types"
export { parseStrongsCode, normalizeStrongsCode } from "./lexicon-types"

/** Get a Strong's entry by code (e.g. "G26", "H3045"). Checks local sample, then OpenScriptures. Returns null if not found. */
export async function getStrongsEntry(code: string): Promise<StrongsEntry | null> {
  const normalized = normalizeStrongsCode(code)
  if (!normalized) return null
  const local = LEXICON_SAMPLE[normalized]
  if (local) return local
  return getStrongsFromOpenScriptures(code)
}

/** Get multiple Strong's entries by code. Returns only found entries. */
export async function getStrongsEntries(codes: string[]): Promise<StrongsEntry[]> {
  const results = await Promise.all(codes.map((c) => getStrongsEntry(c)))
  return results.filter((e): e is StrongsEntry => e != null)
}
