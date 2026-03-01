/**
 * Devotions user preferences — localStorage, this device only.
 * Used for optional tracking visibility and future settings.
 */

const SETTINGS_KEY = "fx_devotions_v1_settings"

export type DevotionsSettings = {
  showTracking: boolean
  /** Chapters to advance per session in a reading plan (1 or 2). */
  chaptersPerDay: number
}

const defaults: DevotionsSettings = {
  showTracking: true,
  chaptersPerDay: 1,
}

function safeParse(raw: string | null): DevotionsSettings {
  if (!raw) return defaults
  try {
    const parsed = JSON.parse(raw) as Partial<DevotionsSettings>
    const chaptersPerDay =
      typeof parsed.chaptersPerDay === "number" && parsed.chaptersPerDay >= 1 && parsed.chaptersPerDay <= 5
        ? parsed.chaptersPerDay
        : defaults.chaptersPerDay
    return {
      showTracking: typeof parsed.showTracking === "boolean" ? parsed.showTracking : defaults.showTracking,
      chaptersPerDay,
    }
  } catch {
    return defaults
  }
}

export function getDevotionsSettings(): DevotionsSettings {
  if (typeof window === "undefined") return defaults
  return safeParse(window.localStorage.getItem(SETTINGS_KEY))
}

export function saveDevotionsSettings(settings: DevotionsSettings): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function setShowTracking(show: boolean): void {
  saveDevotionsSettings({ ...getDevotionsSettings(), showTracking: show })
}

export function setChaptersPerDay(n: number): void {
  const clamped = Math.min(5, Math.max(1, Math.floor(n)))
  saveDevotionsSettings({ ...getDevotionsSettings(), chaptersPerDay: clamped })
}
