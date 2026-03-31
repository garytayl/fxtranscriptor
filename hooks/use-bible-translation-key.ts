"use client"

import { useSyncExternalStore } from "react"

import {
  BIBLE_TRANSLATION_CHANGED_EVENT,
  BIBLE_TRANSLATION_STORAGE_KEY,
} from "@/lib/bible/translation-storage"

/**
 * Reader translation preference (localStorage), aligned with TranslationSettings.
 * `null` means use server default for `/api/bible/passage` (no `t` param).
 */
export function usePreferredBibleTranslationKey(): string | null {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => {}
      const onStorage = (e: StorageEvent) => {
        if (e.key === BIBLE_TRANSLATION_STORAGE_KEY || e.key === null) onStoreChange()
      }
      const onCustom = () => onStoreChange()
      window.addEventListener("storage", onStorage)
      window.addEventListener(BIBLE_TRANSLATION_CHANGED_EVENT, onCustom)
      return () => {
        window.removeEventListener("storage", onStorage)
        window.removeEventListener(BIBLE_TRANSLATION_CHANGED_EVENT, onCustom)
      }
    },
    () => (typeof window !== "undefined" ? localStorage.getItem(BIBLE_TRANSLATION_STORAGE_KEY) : null),
    () => null
  )
}
