/**
 * Shared translation keys / pseudo–bible ids for the scripture reader.
 * Safe to import from client components (no server-only).
 */

/** Virtual translation: KJV English + Strong's + Greek morph UI, with a dedicated label in the picker. */
export const FX_GREEK_GRAMMAR_TRANSLATION_KEY = "fx-greek"

/** Passed to API layer as bibleId; resolved server-side to the configured KJV API.Bible id. */
export const LOCAL_FX_GREEK_GRAMMAR_BIBLE_ID = "local-FX-GREEK-GRAMMAR"
