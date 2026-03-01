import { NextResponse } from "next/server"

/**
 * Returns the public VAPID key for push subscription.
 * Set VAPID_PUBLIC_KEY in Vercel (same value as on Railway worker).
 */
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY?.trim()
  if (!key) {
    return NextResponse.json({ error: "Push not configured" }, { status: 503 })
  }
  return NextResponse.json({ vapidPublicKey: key })
}
