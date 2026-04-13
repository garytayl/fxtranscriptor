import { LOCAL_FX_GREEK_GRAMMAR_BIBLE_ID } from "@/lib/bible/reader-translation-keys"

/** Same default as `DEFAULT_API_BIBLE_KJV_ID` in translations.ts (avoid import cycle). */
const FALLBACK_KJV_API_BIBLE_ID = "de4e12af7f28f599-01"

export function getUnderlyingKjvBibleIdForFxGreekMode(): string {
  const configured = process.env.API_BIBLE_KJV_ID?.trim()
  if (configured === "") return FALLBACK_KJV_API_BIBLE_ID
  return configured ?? FALLBACK_KJV_API_BIBLE_ID
}

export function resolveReaderTranslationToApiBibleId(bibleId: string): string {
  if (bibleId === LOCAL_FX_GREEK_GRAMMAR_BIBLE_ID) {
    return getUnderlyingKjvBibleIdForFxGreekMode()
  }
  return bibleId
}

export function getFxGreekGrammarTranslationLabel(): string {
  return (
    process.env.API_BIBLE_FX_GREEK_LABEL?.trim() ||
    "FX Archives · Greek grammar (KJV English)"
  )
}
