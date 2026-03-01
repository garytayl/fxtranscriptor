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

/**
 * After permission is granted: register SW, subscribe to push, and POST subscription to our API
 * (which forwards to Railway). Call only from a user gesture.
 */
export async function subscribeToPush(): Promise<{ ok: boolean; error?: string }> {
  if (!supportsNotifications() || Notification.permission !== "granted") {
    return { ok: false, error: "Permission not granted" }
  }
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" })
    await navigator.serviceWorker.ready
    const res = await fetch("/api/push/vapid-public")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { ok: false, error: (data as { error?: string }).error || "Push not configured" }
    }
    const { vapidPublicKey } = (await res.json()) as { vapidPublicKey?: string }
    if (!vapidPublicKey) return { ok: false, error: "Missing VAPID key" }
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })
    const subRes = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    })
    if (!subRes.ok) {
      const data = await subRes.json().catch(() => ({}))
      return { ok: false, error: (data as { error?: string }).error || "Subscribe failed" }
    }
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Subscribe failed"
    return { ok: false, error: message }
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

export function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return !!nav.standalone || window.matchMedia("(display-mode: standalone)").matches
}
