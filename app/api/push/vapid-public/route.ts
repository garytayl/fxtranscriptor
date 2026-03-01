import { NextResponse } from "next/server"

/**
 * Returns the public VAPID key for push subscription.
 * Set VAPID_PUBLIC_KEY in Vercel (same value as on Railway worker).
 * After adding or changing env vars in Vercel, trigger a new deployment so they are available at runtime.
 */
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY?.trim()
  if (!key) {
    return NextResponse.json(
      {
        error:
          "VAPID_PUBLIC_KEY is not set. Add it in Vercel (Settings → Environment Variables), then redeploy so the new variable is available.",
      },
      { status: 503 }
    )
  }
  return NextResponse.json({ vapidPublicKey: key })
}
