import {
  FX_GREEK_GRAMMAR_TRANSLATION_KEY,
  LOCAL_FX_GREEK_GRAMMAR_BIBLE_ID,
} from "@/lib/bible/reader-translation-keys"

/** Default matches `getFxGreekGrammarTranslationLabel()` when `API_BIBLE_FX_GREEK_LABEL` is unset. */
const DEFAULT_FX_GREEK_LABEL = "FX Archives · Greek grammar (KJV English)"

/**
 * Ensures the virtual Greek-grammar reader entry is present (KJV text + Strong's + morph UI).
 * Client components call this so the option appears even if an older server bundle omitted it.
 */
export function withFxGreekTranslation<T extends { key: string; label: string; bibleId: string }>(
  translations: T[],
): T[] {
  if (translations.some((t) => t.key === FX_GREEK_GRAMMAR_TRANSLATION_KEY)) {
    return translations
  }
  return [
    ...translations,
    {
      key: FX_GREEK_GRAMMAR_TRANSLATION_KEY,
      label: DEFAULT_FX_GREEK_LABEL,
      bibleId: LOCAL_FX_GREEK_GRAMMAR_BIBLE_ID,
    } as T,
  ]
}
