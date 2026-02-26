/**
 * Generate sermon sections: GPT returns only section titles and character boundaries
 * (and optional verse refs). Content is filled from transcript slices, not AI prose.
 */

export interface SectionVerse {
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number | null;
  full_reference: string;
}

export interface SermonSectionBoundary {
  title: string;
  start_index: number;
  end_index: number;
  verses: SectionVerse[];
}

export interface SermonSectioningMetadata {
  speaker?: string | null;
  title?: string | null;
  series?: string | null;
}

const MAX_TRANSCRIPT_CHARS = 80_000;

/**
 * Ask GPT to split the transcript into 3–6 thematic sections. Returns only
 * titles and character indices (and verses). No summary prose.
 */
export async function generateSermonSections(
  transcript: string,
  apiKey: string,
  metadata?: SermonSectioningMetadata
): Promise<SermonSectionBoundary[]> {
  if (!apiKey?.trim()) {
    throw new Error("OpenAI API key not configured. Add OPENAI_API_KEY to Vercel environment variables.");
  }

  const trimmed = transcript.trim();
  if (trimmed.length < 200) {
    throw new Error("Transcript too short to section.");
  }

  const capped = trimmed.length > MAX_TRANSCRIPT_CHARS
    ? trimmed.substring(0, MAX_TRANSCRIPT_CHARS)
    : trimmed;
  const totalLength = trimmed.length;

  const contextParts: string[] = [];
  if (metadata?.speaker) contextParts.push(`Speaker: ${metadata.speaker}`);
  if (metadata?.title) contextParts.push(`Title: ${metadata.title}`);
  if (metadata?.series) contextParts.push(`Series: ${metadata.series}`);
  const contextBlock = contextParts.length > 0
    ? `\nSermon context:\n${contextParts.join("\n")}\n`
    : "";

  const prompt = `You are analyzing a sermon transcript to divide it into 3–6 thematic sections. Your job is ONLY to provide a short title and character indices for each section. Do NOT write any summary or prose for the content.

${contextBlock}
The transcript below is ${totalLength} characters long. Character indices you return must be between 0 and ${Math.min(capped.length, totalLength)}. If you are given only the first part of a long transcript, your end_index for the last section may be ${Math.min(capped.length, totalLength)}.

For each section provide:
1. title: A short descriptive title (3–8 words), e.g. "Introduction: The Question of Faith", "The Fall of Israel", "Hezekiah's Response"
2. start_index: Character position where this section starts (inclusive)
3. end_index: Character position where this section ends (exclusive)
4. verses: Any Bible verse references clearly mentioned in this section (e.g. "John 3:16", "Romans 8:28-30"). Use full book names. For single verses set verse_end to null; for ranges set both verse_start and verse_end.

Return valid JSON only, no other text:
{
  "sections": [
    {
      "title": "Section Title Here",
      "start_index": 0,
      "end_index": 2500,
      "verses": [
        { "book": "John", "chapter": 3, "verse_start": 16, "verse_end": null, "full_reference": "John 3:16" }
      ]
    }
  ]
}

Transcript (character indices refer to this text):
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
          content: "You output only valid JSON. You do not write summary prose; you only provide section titles and character indices (start_index, end_index) and optional verse references for each section.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content in OpenAI response");

  let parsed: { sections?: Array<{ title?: string; start_index?: number; end_index?: number; verses?: unknown[] }> };
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error("Failed to parse JSON from OpenAI response");
  }

  if (!parsed.sections || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
    throw new Error("Invalid response: missing or empty sections array");
  }

  const len = totalLength;
  const validated: SermonSectionBoundary[] = parsed.sections
    .map((s: Record<string, unknown>, i: number) => {
      const title = typeof s.title === "string" ? s.title.trim() : `Section ${i + 1}`;
      let start = typeof s.start_index === "number" ? Math.max(0, Math.floor(s.start_index)) : 0;
      let end = typeof s.end_index === "number" ? Math.min(len, Math.ceil(s.end_index)) : len;
      if (start >= end) {
        start = Math.max(0, Math.floor((i * len) / parsed.sections!.length));
        end = Math.min(len, Math.floor(((i + 1) * len) / parsed.sections!.length));
        if (start >= end) end = Math.min(start + 1, len);
      }
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

      return { title, start_index: start, end_index: end, verses };
    })
    .sort((a, b) => a.start_index - b.start_index);

  return validated;
}
