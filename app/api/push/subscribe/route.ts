import { NextRequest, NextResponse } from "next/server"

/**
 * Receives a push subscription from the client and forwards it to the Railway worker.
 * Requires AUDIO_WORKER_URL (Railway worker) and VAPID_PUBLIC_KEY to be set.
 */
export async function POST(request: NextRequest) {
  const workerUrl = process.env.AUDIO_WORKER_URL?.trim()
  if (!workerUrl) {
    return NextResponse.json(
      { error: "Push service not configured (AUDIO_WORKER_URL missing)" },
      { status: 503 }
    )
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const subscription = body && typeof body === "object" && "subscription" in body ? (body as { subscription: unknown }).subscription : null
  if (!subscription || typeof subscription !== "object") {
    return NextResponse.json({ error: "Missing subscription" }, { status: 400 })
  }
  const base = workerUrl.replace(/\/$/, "")
  const res = await fetch(`${base}/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return NextResponse.json(data || { error: "Worker error" }, { status: res.status })
  }
  return NextResponse.json({ success: true })
}
