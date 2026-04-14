import { NextRequest, NextResponse } from "next/server"
import type { MeditationPrepareResponse } from "@/lib/meditation-prepare-types"

export const runtime = "nodejs"

function normalize(value: unknown, fallback: string): string {
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
    | { reference?: unknown; passageText?: unknown; seriesTitle?: unknown }
    | null

  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  const reference = normalize(payload.reference, "Scripture")
  const passageText = normalize(payload.passageText, "")
  const seriesTitle = normalize(payload.seriesTitle, "")

  if (!passageText || passageText.length < 20) {
    return NextResponse.json({ error: "Passage text is too short to guide." }, { status: 400 })
  }

  const seriesLine = seriesTitle ? `Meditation track (optional context): ${seriesTitle}\n` : ""

  const prompt = `You are a gentle guide for Christian lectio-style meditation. The person is about to READ this passage slowly, then journal, then receive follow-up prompts. Your job is ONLY the opening: help them enter the text without preaching a sermon.

${seriesLine}Reference: ${reference}

Passage:
"""
${passageText}
"""

Respond with strict JSON only:
{
  "settling": "One short sentence: body/attention (breath, unclench, slow down). No guilt. Max 120 chars.",
  "readWith": "2 short sentences: HOW to read (pace, repetition, what to notice in THIS passage—images, tension, names). Concrete. Max 320 chars total.",
  "phraseToLinger": "One line: quote or tight paraphrase of 4-12 words that actually appear in the passage (or a clear clause)—something worth sitting with. Must be traceable to the text above.",
  "journalHint": "One inviting question for freewriting after they read—not a test. Max 140 chars."
}

Rules:
- No markdown. No numbered lists inside strings.
- phraseToLinger must be clearly rooted in the passage wording.
- Tone: warm, spacious, not chatty. Never mention AI or models.`

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
      messages: [
        {
          role: "system",
          content:
            "You help people enter Scripture contemplatively. Return strict JSON with keys settling, readWith, phraseToLinger, journalHint only.",
        },
        { role: "user", content: prompt },
      ],
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

  let parsed: Partial<MeditationPrepareResponse>
  try {
    parsed = JSON.parse(content) as Partial<MeditationPrepareResponse>
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) {
      return NextResponse.json({ error: "Could not parse AI response." }, { status: 502 })
    }
    parsed = JSON.parse(match[0]) as Partial<MeditationPrepareResponse>
  }

  return NextResponse.json({
    settling: normalize(parsed.settling, "Take one unhurried breath before you read."),
    readWith: normalize(
      parsed.readWith,
      "Read slowly; notice a word or phrase that holds your attention.",
    ),
    phraseToLinger: normalize(
      parsed.phraseToLinger,
      passageText.split(/\s+/).slice(0, 8).join(" ") + "…",
    ),
    journalHint: normalize(parsed.journalHint, "What surfaced as you sat with this passage?"),
  } satisfies MeditationPrepareResponse)
}
