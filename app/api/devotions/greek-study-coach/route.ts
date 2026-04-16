import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

const MAX_MESSAGE = 6000
const MAX_DIGEST = 12000
const MAX_HISTORY = 12

type ChatTurn = { role: "user" | "assistant"; content: string }

function normalizeText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback
  const t = value.trim()
  return t.length > 0 ? t : fallback
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key is not configured." }, { status: 500 })
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        message?: unknown
        progressDigest?: unknown
        history?: unknown
      }
    | null

  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  const message = normalizeText(payload.message, "")
  const progressDigest = normalizeText(payload.progressDigest, "(No progress summary was sent.)")

  if (!message || message.length > MAX_MESSAGE) {
    return NextResponse.json({ error: "Message is required (or too long)." }, { status: 400 })
  }
  if (progressDigest.length > MAX_DIGEST) {
    return NextResponse.json({ error: "Progress digest is too long." }, { status: 400 })
  }

  let history: ChatTurn[] = []
  const rawH = payload.history
  if (Array.isArray(rawH)) {
    for (const item of rawH.slice(-MAX_HISTORY)) {
      if (!item || typeof item !== "object") continue
      const o = item as Record<string, unknown>
      const role = o.role === "assistant" ? "assistant" : o.role === "user" ? "user" : null
      const content = typeof o.content === "string" ? o.content.trim() : ""
      if (!role || !content || content.length > 8000) continue
      history.push({ role, content })
    }
  }

  const systemPrompt = `You are a warm, concise Koine Greek study coach for someone using our app: Endings Lab, Grammar Reader (pilot verses), Verse Quest (drills + XP), Word bank (review), and per-word AI coach.

You will receive PROGRESS_SNAPSHOT (from their device) and optional chat history. Use the snapshot to personalize advice: suggest Endings vs Reader vs Quest vs word-bank review, reference weak forms and milestones when relevant, and celebrate streaks modestly.

Rules:
- Answer in plain English. Short paragraphs. No markdown headings.
- If they ask something unrelated to Greek, answer briefly then connect to study if natural.
- Do not invent statistics; only use what appears in PROGRESS_SNAPSHOT.
- Be encouraging about slow progress; avoid guilt.
- Optionally end with one God-honoring line only if it fits naturally (not every reply).
- You must respond with strict JSON only: {"reply":"...","followUps":["short suggestion 1","optional 2","optional 3"]}
- reply: main answer (max ~1200 characters). followUps: 0-3 very short chips (max ~90 chars each) for "tap to ask next" — concrete prompts about THEIR weak words or next step.`

  const userBlock = `PROGRESS_SNAPSHOT (learner's device — approximate, for personalization only):
${progressDigest}

CURRENT_MESSAGE:
${message}`

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
  ]

  for (const turn of history) {
    messages.push({ role: turn.role, content: turn.content })
  }
  messages.push({ role: "user", content: userBlock })

  const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.65,
      response_format: { type: "json_object" },
      messages,
    }),
  })

  if (!aiRes.ok) {
    const err = (await aiRes.json().catch(() => ({}))) as { error?: { message?: string } }
    return NextResponse.json(
      { error: err.error?.message ?? `OpenAI request failed (${aiRes.status}).` },
      { status: 502 },
    )
  }

  const data = (await aiRes.json()) as { choices?: { message?: { content?: string } }[] }
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    return NextResponse.json({ error: "OpenAI returned empty content." }, { status: 502 })
  }

  let parsed: { reply?: string; followUps?: string[] } = {}
  try {
    parsed = JSON.parse(content) as { reply?: string; followUps?: string[] }
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) {
      return NextResponse.json({ error: "Could not parse AI response." }, { status: 502 })
    }
    parsed = JSON.parse(match[0]) as { reply?: string; followUps?: string[] }
  }

  const reply = normalizeText(parsed.reply, "I’m here to help—try asking what to drill next, or how to use the Word bank.")
  const rawFollow = Array.isArray(parsed.followUps) ? parsed.followUps : []
  const followUps = rawFollow
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim().slice(0, 96))
    .slice(0, 3)

  return NextResponse.json({ reply, followUps })
}
