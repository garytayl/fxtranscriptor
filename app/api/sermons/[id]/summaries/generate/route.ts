/**
 * API Route: Generate AI summaries for sermon chunks
 * Generates summaries and extracts verses for all chunks of a sermon
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateChunkSummary } from "@/lib/generateChunkSummaries";

export const runtime = "nodejs";

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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.trim().length === 0) {
      return NextResponse.json(
        { error: "OpenAI API key not configured. Add OPENAI_API_KEY to Vercel environment variables." },
        { status: 500 }
      );
    }

    // Fetch sermon to get chunks
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

    // Get chunks from progress_json.completedChunks
    const chunks = sermon.progress_json?.completedChunks;
    if (!chunks || Object.keys(chunks).length === 0) {
      return NextResponse.json(
        { error: "No chunks found for this sermon. Transcript must be generated first." },
        { status: 400 }
      );
    }

    // Clear existing summaries and verses for this sermon
    const { data: existingSummaries } = await supabase
      .from("sermon_chunk_summaries")
      .select("id")
      .eq("sermon_id", sermonId);

    if (existingSummaries && existingSummaries.length > 0) {
      const existingIds = existingSummaries.map((s) => s.id);
      
      // Delete verses first (foreign key constraint)
      await supabase
        .from("sermon_chunk_verses")
        .delete()
        .in("summary_id", existingIds);

      // Delete summaries
      await supabase
        .from("sermon_chunk_summaries")
        .delete()
        .eq("sermon_id", sermonId);
    }

    // Sort chunks by index
    const chunkEntries = Object.entries(chunks).sort(
      ([a], [b]) => Number(a) - Number(b)
    );

    const results = [];
    const errors: string[] = [];

    // Generate summaries for each chunk
    for (const [chunkIndexStr, chunkText] of chunkEntries) {
      const chunkIndex = Number(chunkIndexStr);
      
      try {
        if (!chunkText || typeof chunkText !== "string" || chunkText.trim().length === 0) {
          errors.push(`Chunk ${chunkIndex}: Empty chunk text`);
          continue;
        }

        // Generate summary and extract verses
        const summaryResult = await generateChunkSummary(chunkText, apiKey);

        // Insert summary
        const { data: summary, error: summaryError } = await supabase
          .from("sermon_chunk_summaries")
          .insert({
            sermon_id: sermonId,
            chunk_index: chunkIndex,
            summary: summaryResult.summary,
          })
          .select()
          .single();

        if (summaryError) {
          console.error(`Error inserting summary for chunk ${chunkIndex}:`, summaryError);
          errors.push(`Chunk ${chunkIndex}: Failed to save summary`);
          continue;
        }

        // Insert verses if any
        if (summaryResult.verses.length > 0) {
          const verseInserts = summaryResult.verses.map((verse) => ({
            summary_id: summary.id,
            book: verse.book,
            chapter: verse.chapter,
            verse_start: verse.verse_start,
            verse_end: verse.verse_end,
            full_reference: verse.full_reference,
          }));

          const { error: versesError } = await supabase
            .from("sermon_chunk_verses")
            .insert(verseInserts);

          if (versesError) {
            console.error(`Error inserting verses for chunk ${chunkIndex}:`, versesError);
            errors.push(`Chunk ${chunkIndex}: Failed to save verses`);
          }
        }

        results.push({
          chunk_index: chunkIndex,
          success: true,
        });
      } catch (error) {
        console.error(`Error processing chunk ${chunkIndex}:`, error);
        errors.push(`Chunk ${chunkIndex}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    if (results.length === 0) {
      return NextResponse.json(
        {
          error: "Failed to generate any summaries",
          details: errors.join("; "),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      generated: results.length,
      total: chunkEntries.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error generating summaries:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
