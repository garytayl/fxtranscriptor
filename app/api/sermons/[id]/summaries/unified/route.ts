/**
 * API Route: Generate unified summary from all chunk summaries
 * Creates a cohesive, sectioned summary with inline verse citations
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { SermonMetadata } from "@/lib/generateChunkSummaries";

export const runtime = "nodejs";

export interface UnifiedSummarySection {
  title: string;
  content: string;
  verses: Array<{
    book: string;
    chapter: number;
    verse_start: number;
    verse_end: number | null;
    full_reference: string;
  }>;
  order: number;
}

export interface UnifiedSummaryResponse {
  sections: UnifiedSummarySection[];
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const params = await context.params;
    const sermonId = params?.id;

    if (!sermonId || typeof sermonId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid sermon ID" },
        { status: 400 }
      );
    }

    const { data: sermon, error } = await supabase
      .from("sermons")
      .select("id, unified_summary_json, unified_summary_generated_at, unified_summary_model")
      .eq("id", sermonId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching unified summary:", error);
      return NextResponse.json(
        { error: "Failed to fetch unified summary", details: error.message },
        { status: 500 }
      );
    }

    const sections = Array.isArray((sermon as any)?.unified_summary_json)
      ? ((sermon as any).unified_summary_json as UnifiedSummarySection[])
      : null;

    return NextResponse.json({
      success: true,
      sections: sections || [],
      generated_at: (sermon as any)?.unified_summary_generated_at || null,
      model: (sermon as any)?.unified_summary_model || null,
    });
  } catch (error) {
    console.error("Error fetching unified summary:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const params = await context.params;
    const sermonId = params?.id;

    if (!sermonId || typeof sermonId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid sermon ID" },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.trim().length === 0) {
      return NextResponse.json(
        { error: "OpenAI API key not configured. Add OPENAI_API_KEY to Vercel environment variables." },
        { status: 500 }
      );
    }

    // Fetch sermon metadata
    const { data: sermon, error: sermonError } = await supabase
      .from("sermons")
      .select("*")
      .eq("id", sermonId)
      .maybeSingle();

    if (sermonError) {
      console.error("Error fetching sermon:", sermonError);
      return NextResponse.json(
        { error: "Failed to fetch sermon", details: sermonError.message },
        { status: 500 }
      );
    }

    if (!sermon) {
      return NextResponse.json(
        { error: `Sermon with ID "${sermonId}" not found.` },
        { status: 404 }
      );
    }

    // If we already have a stored unified summary and not forcing regeneration, return it.
    if (!force && Array.isArray((sermon as any).unified_summary_json) && (sermon as any).unified_summary_json.length > 0) {
      return NextResponse.json({
        success: true,
        sections: (sermon as any).unified_summary_json,
        cached: true,
        generated_at: (sermon as any).unified_summary_generated_at || null,
        model: (sermon as any).unified_summary_model || null,
      });
    }

    // Fetch all chunk summaries with verses
    const { data: summaries, error: summariesError } = await supabase
      .from("sermon_chunk_summaries")
      .select(`
        *,
        sermon_chunk_verses (*)
      `)
      .eq("sermon_id", sermonId)
      .order("chunk_index", { ascending: true });

    if (summariesError) {
      console.error("Error fetching summaries:", summariesError);
      return NextResponse.json(
        { error: "Failed to fetch chunk summaries", details: summariesError.message },
        { status: 500 }
      );
    }

    if (!summaries || summaries.length === 0) {
      return NextResponse.json(
        { error: "No chunk summaries found. Please generate chunk summaries first." },
        { status: 400 }
      );
    }

    // Prepare sermon metadata
    const sermonMetadata: SermonMetadata = {
      speaker: sermon.speaker || null,
      title: sermon.title || null,
      series: sermon.series || null,
    };

    // Build context from all chunk summaries
    const chunkSummaries = summaries.map((s, index) => {
      const verses = (s.sermon_chunk_verses || []).map((v: any) => v.full_reference).join(", ");
      return `Chunk ${index + 1}: ${s.summary}${verses ? ` [Verses: ${verses}]` : ""}`;
    }).join("\n\n");

    // Collect all verses for reference
    const allVerses = summaries.flatMap((s) => 
      (s.sermon_chunk_verses || []).map((v: any) => ({
        book: v.book,
        chapter: v.chapter,
        verse_start: v.verse_start,
        verse_end: v.verse_end,
        full_reference: v.full_reference,
      }))
    );

    // Build speaker context
    const speakerContext = sermonMetadata.speaker 
      ? `The speaker is ${sermonMetadata.speaker}.`
      : "";

    const prompt = `You are creating a unified, cohesive summary of a sermon from multiple chunk summaries. Your goal is to create a flowing narrative organized into 3-6 thematic sections.

${speakerContext}
${sermonMetadata.title ? `Sermon Title: ${sermonMetadata.title}` : ""}
${sermonMetadata.series ? `Series: ${sermonMetadata.series}` : ""}

Chunk Summaries:
${chunkSummaries}

Instructions:
1. Create 3-6 thematic sections that flow together naturally (not just separate chunks)
2. Each section should have a descriptive title (e.g., "Introduction: The Question of Reliance", "The Fall of Israel", "Hezekiah's Response")
3. Write flowing prose that connects the sections - this should read like a unified narrative, not separate summaries
4. Include verse citations inline in the text where they're referenced (format: [Book Chapter:Verse] or [Book Chapter:Verse-Verse] for ranges)
5. For each section, identify which verses are referenced in that section's content
6. Maintain the speaker's name throughout (use "${sermonMetadata.speaker || "the speaker"}" directly, not "the sermon discusses")

Return your response as a JSON object with this exact structure:
{
  "sections": [
    {
      "title": "Section Title Here",
      "content": "Flowing prose with inline verse citations like [2 Chronicles 32:6-7] embedded naturally in the text...",
      "verses": [
        {
          "book": "2 Chronicles",
          "chapter": 32,
          "verse_start": 6,
          "verse_end": 7,
          "full_reference": "2 Chronicles 32:6-7"
        }
      ],
      "order": 1
    }
  ]
}

Important:
- Sections should be ordered logically (1, 2, 3, etc.)
- Verse references in content should match the verses array for that section
- Use full book names (e.g., "2 Chronicles", not "2 Chr")
- For verse ranges, include both verse_start and verse_end
- For single verses, set verse_end to null
- Make the content read naturally - verses should be cited where they're discussed, not just listed`;

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a skilled writer creating unified sermon summaries organized into thematic sections with inline verse citations. Always return valid JSON.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.4,
          response_format: { type: "json_object" },
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
      let result: { sections: UnifiedSummarySection[] };
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
      if (!result.sections || !Array.isArray(result.sections)) {
        throw new Error("Invalid response: missing or invalid sections array");
      }

      // Validate and normalize sections
      const validatedSections: UnifiedSummarySection[] = result.sections
        .map((section: any, index: number) => {
          if (!section.title || !section.content) {
            return null;
          }

          // Validate verses
          const validatedVerses = (section.verses || [])
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
            title: section.title.trim(),
            content: section.content.trim(),
            verses: validatedVerses,
            order: typeof section.order === "number" ? section.order : index + 1,
          };
        })
        .filter((section: UnifiedSummarySection | null): section is UnifiedSummarySection => section !== null)
        .sort((a, b) => a.order - b.order);

      if (validatedSections.length === 0) {
        throw new Error("No valid sections generated");
      }

      // Persist the unified summary on the sermon row
      const { error: persistError } = await supabase
        .from("sermons")
        .update({
          unified_summary_json: validatedSections as any,
          unified_summary_generated_at: new Date().toISOString(),
          unified_summary_model: "gpt-4o-mini",
        })
        .eq("id", sermonId);

      if (persistError) {
        console.error("Error persisting unified summary:", persistError);
        // Don't fail the request if persistence fails; still return the generated summary.
      }

      return NextResponse.json({
        success: true,
        sections: validatedSections,
        cached: false,
      });
    } catch (error) {
      console.error("[UnifiedSummary] Error:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error generating unified summary:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
