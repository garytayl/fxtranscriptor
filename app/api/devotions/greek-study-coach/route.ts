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
        /** When "drill", answer the concrete Greek/question in the message—do not route users to app tabs. */
        coachingFocus?: unknown
      }
    | null

  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  const message = normalizeText(payload.message, "")
  const progressDigest = normalizeText(payload.progressDigest, "(No progress summary was sent.)")
  const coachingFocusExplicit = payload.coachingFocus === "drill"
  const coachingFocusDrill =
    coachingFocusExplicit ||
    /Mixed lesson card|App explainer:|Learner's first wrong tap|Still wrong at reveal/i.test(message)

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

  const systemPromptDrill = `You are a Koine Greek tutor. The user's message includes CONTEXT from a practice drill (lesson card, wrong tap, root, gloss, etc.) and a QUESTION.

Your job: answer the QUESTION using the CONTEXT. Give direct Greek help: why the right option works, what pattern to watch for, how roots or endings signal meaning, a quick memory hook, or what to double-check next time. Be concrete and concise.

FORBIDDEN in reply and followUps:
- Do not tell them to open, use, or go to any named part of our app (no "Verse Quest", "Word bank", "Endings Lab", "Grammar Reader", "mixed lesson", "pilot verses", etc.).
- Do not pivot to XP, streaks, milestones, or study plans unless the QUESTION explicitly asks for planning or motivation.

PROGRESS_SNAPSHOT is optional background only: use at most one short clause if it sharpens the same linguistic point; otherwise ignore it entirely.

Rules:
- Plain English. Short paragraphs. No markdown headings.
- Do not invent stats; if you use PROGRESS_SNAPSHOT, only facts stated there.
- Be encouraging; avoid guilt.
- Respond with strict JSON only: {"reply":"...","followUps":["..."]}
- reply: max ~1200 characters, focused on the drill.
- followUps: 0-3 chips (max ~90 chars each)—conceptual Greek follow-ups tied to THIS issue (e.g. "How does tetra- differ from tri-?"), never navigation or app names.`

  const systemPromptGeneral = `You are a warm, concise Koine Greek study coach.

You receive PROGRESS_SNAPSHOT from the learner's device and optional chat history. Help them grow as readers: habits, patterns, how to think about forms, and gentle encouragement.

Rules:
- Answer CURRENT_MESSAGE first. Plain English, short paragraphs, no markdown headings.
- Prefer teaching skills and patterns in the abstract. Do not lean on app navigation: only name a specific app area (e.g. endings practice, verse drills, word review) if the user explicitly asks where to do something in the software—or if one short clause naturally answers "where can I practice X" after you've already answered the Greek substance.
- Do not invent statistics; only use facts from PROGRESS_SNAPSHOT.
- Be encouraging about slow progress; avoid guilt.
- Optionally one God-honoring line only when it fits (not every reply).
- Strict JSON only: {"reply":"...","followUps":["..."]}
- reply: max ~1200 characters.
- followUps: 0-3 chips (max ~90 chars)—concrete Greek or habit prompts, not generic "check your stats".`

  const systemPrompt = coachingFocusDrill ? systemPromptDrill : systemPromptGeneral

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

  const reply = normalizeText(
    parsed.reply,
    coachingFocusDrill
      ? "I’m here to help with the Greek in your question—try asking again with what confused you about the form or answer."
      : "I’m here to help—ask about a pattern you’re stuck on, or how to read a form you keep missing.",
  )
  const rawFollow = Array.isArray(parsed.followUps) ? parsed.followUps : []
  const followUps = rawFollow
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim().slice(0, 96))
    .slice(0, 3)

  return NextResponse.json({ reply, followUps })
}
