/**
 * API Route: Get Sermon Transcript
 * Returns the transcript for a specific sermon ID
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY" },
        { status: 500 }
      );
    }

    const params = await context.params;
    const sermonId = params?.id;

    if (!sermonId) {
      return NextResponse.json(
        { error: "Sermon ID is required" },
        { status: 400 }
      );
    }

    const { data: sermon, error } = await supabase
      .from("sermons")
      .select("transcript")
      .eq("id", sermonId)
      .single();

    if (error) {
      console.error("Error fetching transcript:", error);
      if (error.message.includes("No rows")) {
        return NextResponse.json(
          { error: "Sermon not found", transcript: null, transcript_length: 0 },
          { status: 404 }
        );
      }
      throw error;
    }

    if (!sermon) {
      return NextResponse.json(
        { error: "Sermon not found", transcript: null, transcript_length: 0 },
        { status: 404 }
      );
    }

    const transcript = sermon.transcript || null;
    const transcriptLength = transcript ? transcript.length : 0;

    return NextResponse.json({
      transcript,
      transcript_length: transcriptLength,
    });
  } catch (error) {
    console.error("Error fetching transcript:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return NextResponse.json(
      {
        error: errorMessage,
        transcript: null,
        transcript_length: 0,
      },
      { status: 500 }
    );
  }
}