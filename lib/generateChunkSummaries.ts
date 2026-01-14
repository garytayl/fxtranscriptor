/**
 * Generate AI summaries and extract verses from sermon chunks using OpenAI
 */

export interface VerseReference {
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number | null;
  full_reference: string;
}

export interface ChunkSummaryResult {
  summary: string;
  verses: VerseReference[];
}

export interface SermonMetadata {
  speaker?: string | null;
  title?: string | null;
  series?: string | null;
}

/**
 * Generate summary and extract verses from a chunk using OpenAI
 */
export async function generateChunkSummary(
  chunkText: string,
  apiKey?: string,
  previousSummaries?: string[], // Array of previous chunk summaries for context
  sermonMetadata?: SermonMetadata // Speaker, title, series information
): Promise<ChunkSummaryResult> {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error("OpenAI API key not configured. Add OPENAI_API_KEY to Vercel environment variables.");
  }

  // Build sermon context (speaker, title, series)
  const sermonContextParts: string[] = [];
  if (sermonMetadata?.speaker) {
    sermonContextParts.push(`Speaker: ${sermonMetadata.speaker}`);
  }
  if (sermonMetadata?.title) {
    sermonContextParts.push(`Title: ${sermonMetadata.title}`);
  }
  if (sermonMetadata?.series) {
    sermonContextParts.push(`Series: ${sermonMetadata.series}`);
  }
  const sermonContext = sermonContextParts.length > 0
    ? `\n\nSermon Context:\n${sermonContextParts.join("\n")}\n`
    : "";

  // Include more previous summaries for better continuity (last 4 instead of 2)
  const previousContext = previousSummaries && previousSummaries.length > 0
    ? `\n\nPrevious Chunks (for narrative continuity - build on these naturally):\n${previousSummaries.slice(-4).map((s, i) => `Chunk ${previousSummaries.length - 4 + i + 1}: ${s}`).join("\n\n")}\n`
    : "";

  // Build speaker usage examples for the prompt
  const speakerExample = sermonMetadata?.speaker 
    ? `Use the speaker's name directly (e.g., "${sermonMetadata.speaker} explains..." or "${sermonMetadata.speaker} continues..." or "${sermonMetadata.speaker.split(' ')[0]} emphasizes...")`
    : "Refer to the speaker naturally (e.g., 'he explains...' or 'the speaker continues...')";

  const prompt = `You are creating a summary for one chunk of a sermon transcript. Your goal is to create summaries that flow together as a unified narrative - like a painting, not a collage.

Key Requirements:
1. Write naturally flowing 2-3 sentences that connect to previous chunks when available
2. ${speakerExample} instead of generic phrases like "the sermon discusses" or "the speaker emphasizes"
3. Avoid repetitive introductory phrases like "In this sermon" or "The sermon discusses" - vary your language naturally
4. Build on previous chunks: use transitions, continue thoughts, reference earlier points when relevant
5. Each chunk should feel like the next paragraph in a story, not an isolated summary
6. Extract all Bible verse references mentioned (e.g., "John 3:16", "Romans 8:28-30", "Psalm 23:1-3")

Return your response as a JSON object with this exact structure:
{
  "summary": "Your summary text here",
  "verses": [
    {
      "book": "John",
      "chapter": 3,
      "verse_start": 16,
      "verse_end": null,
      "full_reference": "John 3:16"
    },
    {
      "book": "Romans",
      "chapter": 8,
      "verse_start": 28,
      "verse_end": 30,
      "full_reference": "Romans 8:28-30"
    }
  ]
}

Technical Requirements:
- For single verses, set "verse_end" to null
- For verse ranges, set both "verse_start" and "verse_end"
- Use the full book name (e.g., "John", not "Jn")
- If no verses are mentioned, return an empty array for "verses"
- Only return valid JSON, no other text
${sermonContext}${previousContext}
Current Chunk Transcript:
${chunkText.substring(0, 4000)}${chunkText.length > 4000 ? "..." : ""}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Using mini for cost efficiency
        messages: [
          {
            role: "system",
            content: "You are a skilled writer creating coherent, flowing summaries of sermon chunks that build on each other naturally. You write summaries that read like a unified narrative, using the speaker's name directly and avoiding repetitive phrases. Always return valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent results
        response_format: { type: "json_object" }, // Ensure JSON response
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
      throw new Error(`OpenAI API error: ${errorMessage}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    // Parse JSON response
    let result: { summary: string; verses: VerseReference[] };
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      // Try to extract JSON from response if it's wrapped in markdown
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse JSON from OpenAI response");
      }
    }

    // Validate structure
    if (!result.summary || typeof result.summary !== "string") {
      throw new Error("Invalid response: missing or invalid summary");
    }

    if (!Array.isArray(result.verses)) {
      result.verses = [];
    }

    // Validate and normalize verses
    const validatedVerses: VerseReference[] = result.verses
      .filter((verse: any) => {
        return (
          verse &&
          typeof verse.book === "string" &&
          typeof verse.chapter === "number" &&
          typeof verse.verse_start === "number" &&
          typeof verse.full_reference === "string"
        );
      })
      .map((verse: any) => ({
        book: verse.book.trim(),
        chapter: verse.chapter,
        verse_start: verse.verse_start,
        verse_end: typeof verse.verse_end === "number" ? verse.verse_end : null,
        full_reference: verse.full_reference.trim(),
      }));

    return {
      summary: result.summary.trim(),
      verses: validatedVerses,
    };
  } catch (error) {
    console.error("[GenerateChunkSummary] Error:", error);
    throw error;
  }
}
