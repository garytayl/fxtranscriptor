"use client"

import { useCallback, useEffect, useState } from "react"

/** Verse Quest + Grammar reader display toggles; persisted per browser profile. */
export const GREEK_UI_PREFS_STORAGE_KEY = "fx_devotions_greek_v1_ui_prefs"

export type GreekUiPreferences = {
  wordHintsEnabled: boolean
  showEnglish: boolean
  reviewMode: boolean
}

export const GREEK_UI_PREFERENCES_DEFAULTS: GreekUiPreferences = {
  wordHintsEnabled: false,
  showEnglish: true,
  reviewMode: false,
}

function parseStored(raw: string | null): GreekUiPreferences {
  const d = GREEK_UI_PREFERENCES_DEFAULTS
  if (!raw) return d
  try {
    const p = JSON.parse(raw) as Partial<GreekUiPreferences>
    return {
      wordHintsEnabled: typeof p.wordHintsEnabled === "boolean" ? p.wordHintsEnabled : d.wordHintsEnabled,
      showEnglish: typeof p.showEnglish === "boolean" ? p.showEnglish : d.showEnglish,
      reviewMode: typeof p.reviewMode === "boolean" ? p.reviewMode : d.reviewMode,
    }
  } catch {
    return d
  }
}

export function loadGreekUiPreferences(): GreekUiPreferences {
  if (typeof window === "undefined") return GREEK_UI_PREFERENCES_DEFAULTS
  return parseStored(window.localStorage.getItem(GREEK_UI_PREFS_STORAGE_KEY))
}

export function persistGreekUiPreferences(next: GreekUiPreferences) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(GREEK_UI_PREFS_STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Loads saved Greek UI prefs after mount (defaults first to avoid SSR mismatch)
 * and writes through to localStorage on each update. Syncs across tabs via storage events.
 */
export function useGreekUiPreferences() {
  const [prefs, setPrefs] = useState<GreekUiPreferences>(GREEK_UI_PREFERENCES_DEFAULTS)

  useEffect(() => {
    setPrefs(loadGreekUiPreferences())
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === GREEK_UI_PREFS_STORAGE_KEY) setPrefs(loadGreekUiPreferences())
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const updatePrefs = useCallback((patch: Partial<GreekUiPreferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      persistGreekUiPreferences(next)
      return next
    })
  }, [])

  return { prefs, updatePrefs }
}
