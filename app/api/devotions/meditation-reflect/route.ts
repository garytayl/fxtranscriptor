import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

type ReflectResponse = {
  opening: string
  prompts: string[]
}

function normalize(value: unknown, fallback = ""): string {
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
    | { reference?: unknown; passageText?: unknown; userReflection?: unknown }
    | null

  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  const reference = normalize(payload.reference, "Scripture")
  const passageText = normalize(payload.passageText, "")
  const userReflection = normalize(payload.userReflection, "")

  if (userReflection.length < 4) {
    return NextResponse.json({ error: "Add a few words about what you noticed or felt first." }, { status: 400 })
  }

  const prompt = `You help someone reflect prayerfully after they sat with a Bible passage and wrote freely.

Passage reference: ${reference}
Passage text:
"""
${passageText || "(not provided)"}
"""

What they wrote (their words, preserve meaning; do not moralize at them):
"""
${userReflection}
"""

Respond with strict JSON only:
{
  "opening": "1-2 short sentences: warm, specific to their words and the passage. No scolding. No \"As an AI\".",
  "prompts": ["3 or 4 distinct reflection questions or invitations — concise, plain English, rooted in their writing and the passage. No numbering in the strings."]
}

Rules:
- prompts must be an array of 3 to 4 strings.
- No markdown in any field. No duplicate questions.
- Honor Christian contemplative tone; avoid generic self-help clichés.`

  const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.75,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You write brief, humane spiritual reflection prompts. Return strict JSON with keys opening (string) and prompts (array of strings) only.",
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

  let parsed: Partial<ReflectResponse> & { prompts?: unknown }
  try {
    parsed = JSON.parse(content) as Partial<ReflectResponse> & { prompts?: unknown }
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) {
      return NextResponse.json({ error: "Could not parse AI response." }, { status: 502 })
    }
    parsed = JSON.parse(match[0]) as Partial<ReflectResponse> & { prompts?: unknown }
  }

  const rawPrompts = parsed.prompts
  const prompts = Array.isArray(rawPrompts)
    ? rawPrompts.filter((p): p is string => typeof p === "string").map((p) => p.trim()).filter(Boolean)
    : []

  const opening = normalize(parsed.opening, "Here are a few ways to stay with this passage.")

  if (prompts.length < 2) {
    return NextResponse.json(
      {
        opening,
        prompts: [
          ...prompts,
          "What word or phrase from the passage stayed with you longest?",
          "What would it look like to carry one line of this into today?",
        ].slice(0, 4),
      } satisfies ReflectResponse,
    )
  }

  return NextResponse.json({ opening, prompts: prompts.slice(0, 4) } satisfies ReflectResponse)
}
