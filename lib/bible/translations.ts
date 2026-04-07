import "server-only"

import { getBibleInfo } from "@/lib/bible/api"
import { LOCAL_HCSB_BIBLE_ID } from "@/lib/bible/local-hcsb"

export type BibleTranslation = {
  key: string
  label: string
  bibleId: string
}

let cachedTranslations: BibleTranslation[] | null = null
let cachedResolvedTranslations: BibleTranslation[] | null = null

function parseCommaSeparatedTranslations(raw: string): BibleTranslation[] {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [key, bibleId] = entry.split(":").map((part) => part.trim())
      if (!key || !bibleId) {
        return null
      }
      return { key, label: key, bibleId }
    })
    .filter((entry): entry is BibleTranslation => Boolean(entry))
}

export function getAvailableTranslations(): BibleTranslation[] {
  if (cachedTranslations) {
    return cachedTranslations
  }

  const jsonRaw = process.env.API_BIBLE_TRANSLATIONS_JSON
  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw) as Array<{ key: string; label?: string; bibleId: string }>
      const translations = parsed
        .map((entry) => ({
          key: entry.key,
          label: entry.label ?? entry.key,
          bibleId: entry.bibleId,
        }))
        .filter((entry) => entry.key && entry.bibleId)
      cachedTranslations = translations
      return translations
    } catch {
      // Fall through to other formats.
    }
  }

  const csvRaw = process.env.API_BIBLE_TRANSLATIONS
  if (csvRaw) {
    const translations = parseCommaSeparatedTranslations(csvRaw)
    cachedTranslations = translations
    return translations
  }

  // BSB + WEBU only: use when both IDs are set. IDs must come from YOUR key's allowed list (GET /v1/bibles).
  // 403 = "You are not authorized to access that bible" means that ID is not on your plan — use IDs from the API response.
  const bsbId = process.env.API_BIBLE_BSB_ID
  const webuId = process.env.API_BIBLE_WEBU_ID
  if (bsbId && webuId) {
    cachedTranslations = [
      { key: "bsb", label: "Berean Standard Bible", bibleId: bsbId },
      { key: "webu", label: "World English Bible (Updated)", bibleId: webuId },
    ]
    return cachedTranslations
  }

  const singleId = process.env.API_BIBLE_BIBLE_ID
  if (singleId) {
    const label = process.env.API_BIBLE_TRANSLATION_LABEL || "Default"
    cachedTranslations = [{ key: "default", label, bibleId: singleId }]
    return cachedTranslations
  }

  cachedTranslations = []
  return cachedTranslations
}

export async function getResolvedTranslations(): Promise<BibleTranslation[]> {
  if (cachedResolvedTranslations) {
    return cachedResolvedTranslations
  }

  const available = getAvailableTranslations()
  const withHcsb: BibleTranslation[] = [
    { key: "hcsb", label: "HCSB (Holman Christian Standard Bible)", bibleId: LOCAL_HCSB_BIBLE_ID },
    ...available,
  ]

  const resolved = await Promise.all(
    withHcsb.map(async (translation) => {
      if (translation.bibleId === LOCAL_HCSB_BIBLE_ID) {
        return translation
      }
      try {
        const info = await getBibleInfo(translation.bibleId)
        return {
          ...translation,
          label: info?.name || translation.label,
        }
      } catch {
        return translation
      }
    })
  )

  cachedResolvedTranslations = resolved
  return resolved
}

export async function getResolvedTranslationByKey(
  key: string | null | undefined
): Promise<BibleTranslation | null> {
  const resolved = await getResolvedTranslations()
  const fallback = getDefaultTranslation()
  if (!key) {
    return fallback
  }
  return resolved.find((translation) => translation.key === key) ?? fallback
}

export function getDefaultTranslationKey(): string | null {
  const configuredDefault = process.env.API_BIBLE_DEFAULT_TRANSLATION
  if (configuredDefault) {
    return configuredDefault
  }

  const available = getAvailableTranslations()
  if (available.length > 0) return available[0].key
  return "hcsb"
}

export function getDefaultTranslation(): BibleTranslation | null {
  const available = getAvailableTranslations()
  const defaultKey = getDefaultTranslationKey()
  if (!defaultKey) return null
  const fromAvailable = available.find((t) => t.key === defaultKey) ?? available[0]
  if (fromAvailable) return fromAvailable
  if (defaultKey === "hcsb") {
    return { key: "hcsb", label: "HCSB (Holman Christian Standard Bible)", bibleId: LOCAL_HCSB_BIBLE_ID }
  }
  return null
}

export function getTranslationByKey(key: string | null | undefined): BibleTranslation | null {
  if (!key) {
    return getDefaultTranslation()
  }
  const available = getAvailableTranslations()
  return available.find((translation) => translation.key === key) ?? getDefaultTranslation()
}

export function getDefaultBibleId(): string | undefined {
  return getDefaultTranslation()?.bibleId
}

/**
 * Translation key(s) for which we show KJV-aligned per-word Strong's in the scripture reader.
 * Default key is `kjv`. Set `API_BIBLE_KJV_KEY` to a comma-separated list if your KJV uses another key.
 */
export function isKjvTranslationKey(key: string | null | undefined): boolean {
  if (!key) return false
  const configured = process.env.API_BIBLE_KJV_KEY ?? "kjv"
  const allowed = configured
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
  return allowed.includes(key.trim().toLowerCase())
}
