import "server-only"

import { getBibleInfo } from "@/lib/bible/api"

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
  if (available.length === 0) {
    cachedResolvedTranslations = []
    return cachedResolvedTranslations
  }

  const resolved = await Promise.all(
    available.map(async (translation) => {
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
  return available.length > 0 ? available[0].key : null
}

export function getDefaultTranslation(): BibleTranslation | null {
  const available = getAvailableTranslations()
  const defaultKey = getDefaultTranslationKey()
  if (!defaultKey) {
    return null
  }
  return available.find((translation) => translation.key === defaultKey) ?? available[0] ?? null
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
