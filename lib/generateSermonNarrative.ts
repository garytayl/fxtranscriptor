/**
 * Generate a sermon narrative: GPT synthesizes the transcript into a readable
 * story-like article, weaving in direct quotes from the speaker. This is NOT
 * a summary — it's a crafted retelling that captures the arc, emotion, and
 * key moments of the sermon.
 */

export interface NarrativeVerse {
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number | null;
  full_reference: string;
}

export interface NarrativeSection {
  title: string;
  content: string;
  verses: NarrativeVerse[];
  order: number;
}

export interface SermonNarrativeMetadata {
  speaker?: string | null;
  title?: string | null;
  series?: string | null;
  date?: string | null;
}

const MAX_TRANSCRIPT_CHARS = 80_000;

export async function generateSermonNarrative(
  transcript: string,
  apiKey: string,
  metadata?: SermonNarrativeMetadata
): Promise<NarrativeSection[]> {
  if (!apiKey?.trim()) {
    throw new Error("OpenAI API key not configured.");
  }

  const trimmed = transcript.trim();
  if (trimmed.length < 200) {
    throw new Error("Transcript too short to synthesize.");
  }

  const capped =
    trimmed.length > MAX_TRANSCRIPT_CHARS
      ? trimmed.substring(0, MAX_TRANSCRIPT_CHARS)
      : trimmed;

  const contextParts: string[] = [];
  if (metadata?.speaker) contextParts.push(`Speaker: ${metadata.speaker}`);
  if (metadata?.title) contextParts.push(`Sermon title: ${metadata.title}`);
  if (metadata?.series) contextParts.push(`Series: ${metadata.series}`);
  if (metadata?.date) contextParts.push(`Date: ${metadata.date}`);
  const contextBlock =
    contextParts.length > 0
      ? `\nSermon context:\n${contextParts.join("\n")}\n`
      : "";

  const speakerName = metadata?.speaker || "the speaker";

  const prompt = `You are a skilled writer synthesizing a church sermon transcript into a compelling, readable narrative. Your goal is to tell the STORY of the sermon — capturing its arc, emotion, turning points, and key moments.

${contextBlock}
CRITICAL RULES:
1. DO NOT summarize. Instead, SYNTHESIZE — pull together the threads of the sermon into a cohesive narrative that reads like a well-crafted article or essay.
2. USE DIRECT QUOTES from the transcript liberally. Wrap them in quotation marks. These are the speaker's actual words — they carry weight and authenticity. Use at least 2-3 quotes per section.
3. Write in THIRD PERSON about ${speakerName} (e.g., "${speakerName} opened by asking…", "${speakerName} challenged the congregation…").
4. Capture the EMOTIONAL TONE — if the speaker was passionate, convicted, gentle, humorous, let that come through.
5. Don't sanitize or flatten the message. Preserve the speaker's voice and intensity.
6. Include Bible verse references naturally in the text when the speaker references them.
7. Create 3–6 sections that follow the natural arc of the sermon (opening, development, climax, application, closing).
8. Each section should be 150-400 words — substantial enough to convey the moment but not so long it becomes a transcript.
9. Section titles should be evocative and specific, not generic (e.g., "Running From the Call" not "Introduction").

Return valid JSON only:
{
  "sections": [
    {
      "title": "Evocative Section Title",
      "content": "The narrative text for this section, with \\"direct quotes\\" from the speaker woven in naturally. Include verse references like John 3:16 inline when the speaker references them.",
      "verses": [
        { "book": "John", "chapter": 3, "verse_start": 16, "verse_end": null, "full_reference": "John 3:16" }
      ]
    }
  ]
}

TRANSCRIPT:
${capped}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            'You are a gifted writer who synthesizes sermon transcripts into compelling narratives. You write in third person, use direct quotes from the speaker extensively, and capture the emotional arc. You output only valid JSON with a "sections" array.',
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      (err as Record<string, Record<string, string>>)?.error?.message ||
        `OpenAI API error: ${response.status}`
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content in OpenAI response");

  let parsed: {
    sections?: Array<{
      title?: string;
      content?: string;
      verses?: unknown[];
    }>;
  };
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error("Failed to parse JSON from OpenAI response");
  }

  if (
    !parsed.sections ||
    !Array.isArray(parsed.sections) ||
    parsed.sections.length === 0
  ) {
    throw new Error("Invalid response: missing or empty sections array");
  }

  const sections: NarrativeSection[] = parsed.sections.map((s, i) => {
    const title =
      typeof s.title === "string" ? s.title.trim() : `Section ${i + 1}`;
    const sectionContent =
      typeof s.content === "string" ? s.content.trim() : "";
    const verses = (Array.isArray(s.verses) ? s.verses : [])
      .filter(
        (v: unknown): v is Record<string, unknown> =>
          v !== null &&
          typeof v === "object" &&
          typeof (v as Record<string, unknown>).book === "string" &&
          typeof (v as Record<string, unknown>).chapter === "number" &&
          typeof (v as Record<string, unknown>).verse_start === "number" &&
          typeof (v as Record<string, unknown>).full_reference === "string"
      )
      .map((v: Record<string, unknown>) => ({
        book: String(v.book).trim(),
        chapter: Number(v.chapter),
        verse_start: Number(v.verse_start),
        verse_end: typeof v.verse_end === "number" ? v.verse_end : null,
        full_reference: String(v.full_reference).trim(),
      }));

    return { title, content: sectionContent, verses, order: i + 1 };
  });

  return sections;
}
