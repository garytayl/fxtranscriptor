/**
 * Devotions user preferences — localStorage, this device only.
 * Used for optional tracking visibility and future settings.
 */

const SETTINGS_KEY = "fx_devotions_v1_settings"

export type DevotionsSettings = {
  showTracking: boolean
}

const defaults: DevotionsSettings = {
  showTracking: true,
}

function safeParse(raw: string | null): DevotionsSettings {
  if (!raw) return defaults
  try {
    const parsed = JSON.parse(raw) as Partial<DevotionsSettings>
    return {
      showTracking: typeof parsed.showTracking === "boolean" ? parsed.showTracking : defaults.showTracking,
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
