/**
 * API Route: Generate Transcript for a Sermon
 * Generates transcript for a specific sermon and stores it in the database
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchTranscript } from "@/lib/fetchTranscript";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { sermonId } = body;

    if (!sermonId || typeof sermonId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid sermonId" },
        { status: 400 }
      );
    }

    // Get sermon from database
    const { data: sermon, error: fetchError } = await supabase
      .from("sermons")
      .select("*")
      .eq("id", sermonId)
      .single();

    if (fetchError || !sermon) {
      return NextResponse.json(
        { error: "Sermon not found" },
        { status: 404 }
      );
    }

    // Check if transcript already exists
    if (sermon.transcript && sermon.transcript.trim().length > 100) {
      return NextResponse.json({
        success: true,
        message: "Transcript already exists",
        sermon,
      });
    }

    // Update status to "generating"
    await supabase
      .from("sermons")
      .update({ status: "generating" })
      .eq("id", sermonId);

    // Try to fetch transcript from available sources (YouTube preferred, then Podbean)
    let transcriptResult = null;
    let transcriptSource: string | null = null;

    // Priority 1: Try YouTube
    if (sermon.youtube_url) {
      transcriptResult = await fetchTranscript(sermon.youtube_url);
      if (transcriptResult.success && transcriptResult.transcript.trim().length > 100) {
        transcriptSource = transcriptResult.source || "youtube";
      }
    }

    // Priority 2: Try Podbean if YouTube failed
    if (!transcriptResult?.success && sermon.podbean_url) {
      transcriptResult = await fetchTranscript(sermon.podbean_url);
      if (transcriptResult.success && transcriptResult.transcript.trim().length > 100) {
        transcriptSource = transcriptResult.source || "podbean";
      }
    }

    // Update sermon with transcript or error
    if (transcriptResult?.success && transcriptResult.transcript.trim().length > 100) {
      const { data: updatedSermon, error: updateError } = await supabase
        .from("sermons")
        .update({
          transcript: transcriptResult.transcript.trim(),
          transcript_source: transcriptSource as any,
          transcript_generated_at: new Date().toISOString(),
          status: "completed",
          error_message: null,
        })
        .eq("id", sermonId)
        .select()
        .single();

      if (updateError) throw updateError;

      return NextResponse.json({
        success: true,
        sermon: updatedSermon,
      });
    } else {
      // Update with error status
      const errorMessage = transcriptResult?.error || "Failed to extract transcript from available sources";
      
      await supabase
        .from("sermons")
        .update({
          status: "failed",
          error_message: errorMessage,
        })
        .eq("id", sermonId);

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          sermon: {
            ...sermon,
            status: "failed",
            error_message: errorMessage,
          },
        },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Error generating transcript:", error);
    
    // Update sermon status to failed
    try {
      const body = await request.json();
      if (body.sermonId && supabase) {
        await supabase
          .from("sermons")
          .update({
            status: "failed",
            error_message: error instanceof Error ? error.message : "Unknown error",
          })
          .eq("id", body.sermonId);
      }
    } catch (e) {
      // Ignore update errors
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
