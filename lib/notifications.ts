/**
 * Notification permission for PWA (e.g. iOS home screen app).
 * Request must be triggered by user gesture. iOS 16.4+ supports web push for PWAs.
 */

const DISMISSED_KEY = "fxarchives-notification-prompt-dismissed"

export function supportsNotifications(): boolean {
  if (typeof window === "undefined") return false
  return "Notification" in window && "requestPermission" in Notification
}

export function isNotificationPermissionGranted(): boolean {
  if (!supportsNotifications()) return false
  return Notification.permission === "granted"
}

export function wasNotificationPromptDismissed(): boolean {
  if (typeof localStorage === "undefined") return true
  return localStorage.getItem(DISMISSED_KEY) === "1"
}

export function setNotificationPromptDismissed(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, "1")
  } catch {
    // ignore
  }
}

/**
 * Call only from a user gesture (e.g. button click). Returns the permission result.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!supportsNotifications()) return "denied"
  const permission = await Notification.requestPermission()
  return permission
}

export function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return !!nav.standalone || window.matchMedia("(display-mode: standalone)").matches
}
