import { NextRequest, NextResponse } from "next/server"

type GreekCoachResponse = {
  insight: string
  prayerPrompt: string
  microGloss: string
  grammarHook: string
  reflectionPrompt: string
}

export const runtime = "nodejs"

function normalizeText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key is not configured." }, { status: 500 })
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        reference?: unknown
        greekWord?: unknown
        lemma?: unknown
        parse?: unknown
        category?: unknown
        parseSummary?: unknown
        english?: unknown
        verseGreek?: unknown
        userQuestion?: unknown
        /** Optional: learner just finished a verse-quest multiple-choice on this word */
        quizContext?: unknown
      }
    | null

  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  const reference = normalizeText(payload.reference, "Unknown reference")
  const greekWord = normalizeText(payload.greekWord, "")
  const lemma = normalizeText(payload.lemma, "")
  const parse = normalizeText(payload.parse, "")
  const category = normalizeText(payload.category, "Word")
  const parseSummary = normalizeText(payload.parseSummary, "Contextual meaning depends on sentence flow.")
  const english = normalizeText(payload.english, "")
  const verseGreek = normalizeText(payload.verseGreek, "")
  const userQuestion = normalizeText(payload.userQuestion, "")

  const rawQuiz = payload.quizContext
  let quizBlock = ""
  if (rawQuiz && typeof rawQuiz === "object" && rawQuiz !== null) {
    const q = rawQuiz as Record<string, unknown>
    const qKind = normalizeText(q.kind, "")
    const qPrompt = normalizeText(q.prompt, "")
    const qOutcome = normalizeText(q.outcome, "")
    const qCorrect = normalizeText(q.correctAnswer, "")
    const qChosen = normalizeText(q.chosenAnswer, "")
    const qOptions = Array.isArray(q.options) ? q.options.filter((x): x is string => typeof x === "string") : []
    if (qPrompt && qOutcome) {
      quizBlock = `
Recent in-app quiz (same word):
- Quiz type: ${qKind || "grammar"}
- Question: ${qPrompt}
- Outcome: ${qOutcome}${qChosen ? ` (learner chose: ${qChosen})` : ""}
- Correct option: ${qCorrect || "(see question)"}
- Options were: ${qOptions.length > 0 ? qOptions.join(" | ") : "(not listed)"}
The learner may ask follow-ups about this quiz. Relate answers to the morphology/lemma above and why the correct option fits.`
    }
  }

  if (!greekWord || !lemma || !parse) {
    return NextResponse.json({ error: "Missing required Greek word payload fields." }, { status: 400 })
  }

  const prompt = `You are a friendly Koine Greek tutor. The learner wants to learn how to *read Greek forms*, not get a sermon about historical figures.

Priority: teach what to **notice in this exact surface word** (letters, common endings, rough breathing, obvious suffix patterns) and how that lines up with the parse code—like a coach pointing at the word, not like a commentary on Roman history.

Word data:
- Reference: ${reference}
- Surface word: ${greekWord}
- Lemma: ${lemma}
- Category: ${category}
- Parse code: ${parse}
- Parse summary: ${parseSummary}
- Greek phrase context: ${verseGreek || "(not provided)"}
- English context: ${english || "(not provided)"}
${quizBlock}
${userQuestion ? `- Learner's exact question: ${userQuestion}` : ""}

Respond with strict JSON only:
{
  "insight": "1-2 sentences: what to look at in THIS spelling (e.g. ending letters, recognizable suffix, stem shape) and what that suggests. If the learner asked something, answer it briefly here first.",
  "grammarHook": "1 sentence: tie a visible part of the surface word to the grammar (case/tense/voice/etc.). Say it in plain English—no tables, but be concrete (e.g. how -οι/-αι/-α often signal plural, augment patterns, article + noun shape).",
  "microGloss": "1 short sentence: plain English gloss or who/what it names in this verse.",
  "prayerPrompt": "ONE short line only: optional God-honoring takeaway from how this word works in the sentence. Do NOT repeat the same theme as reflectionPrompt.",
  "reflectionPrompt": "ONE short question or habit: either a reading-strategy tip (what to scan for next time you see this ending) OR one light devotional angle—never two questions about authorities, rulers, or parallel themes."
}

Hard rules:
- Do not output two similar questions (e.g. both about "leaders" or "Festus in your life"). Make prayerPrompt and reflectionPrompt clearly different, or make one a concrete reading tip.
- Do not waste the whole insight on "it's a proper noun" without saying what in the **form** supports the parse (ending, capitalization pattern in context, etc.).
- Each field max 240 characters. No markdown. No extra keys. Never mention AI or models.`

  const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a concise Koine Greek morphology coach for readers. Favor spelling cues and endings over abstract morals. Return strict JSON with the requested keys only.",
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

  let parsed: Partial<GreekCoachResponse> = {}
  try {
    parsed = JSON.parse(content) as Partial<GreekCoachResponse>
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) {
      return NextResponse.json({ error: "Could not parse AI response." }, { status: 502 })
    }
    parsed = JSON.parse(match[0]) as Partial<GreekCoachResponse>
  }

  return NextResponse.json({
    insight: normalizeText(
      parsed.insight,
      normalizeText(parsed.microGloss, "Compare the letters at the end of this form to what your parse code names."),
    ),
    prayerPrompt: normalizeText(
      parsed.prayerPrompt,
      normalizeText(parsed.reflectionPrompt, "What small spelling cue will you look for next time you meet this form?"),
    ),
    microGloss: normalizeText(parsed.microGloss, "This word helps shape the line's meaning in context."),
    grammarHook: normalizeText(
      parsed.grammarHook,
      "Look at the ending (or visible suffix) and match it to case, number, or tense in your parse.",
    ),
    reflectionPrompt: normalizeText(
      parsed.reflectionPrompt,
      "Which part of this word would you trace first when checking the parse?",
    ),
  } satisfies GreekCoachResponse)
}
