/**
 * API Route: Update Audio URL
 * Allows manual override of audio_url for a sermon
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractFromPodbean } from "@/lib/extractFromPodbean";

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
    const { sermonId, audioUrl, podbeanUrl } = body;

    if (!sermonId) {
      return NextResponse.json(
        { error: "Missing sermonId" },
        { status: 400 }
      );
    }

    // If podbeanUrl is provided, extract the audio URL from it
    let finalAudioUrl = audioUrl;
    
    if (podbeanUrl && !audioUrl) {
      try {
        console.log(`[UpdateAudio] Extracting audio URL from Podbean episode: ${podbeanUrl}`);
        const podbeanResult = await extractFromPodbean(podbeanUrl);
        if (podbeanResult.audioUrl) {
          finalAudioUrl = podbeanResult.audioUrl;
          console.log(`[UpdateAudio] Extracted audio URL: ${finalAudioUrl.substring(0, 80)}...`);
        } else {
          return NextResponse.json(
            { error: "Could not extract audio URL from Podbean episode. Please provide a direct MP3/M4A URL instead." },
            { status: 400 }
          );
        }
      } catch (extractError) {
        console.error(`[UpdateAudio] Error extracting from Podbean:`, extractError);
        return NextResponse.json(
          { error: `Failed to extract audio URL from Podbean episode: ${extractError instanceof Error ? extractError.message : "Unknown error"}` },
          { status: 400 }
        );
      }
    }

    if (!finalAudioUrl || finalAudioUrl.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing audioUrl or podbeanUrl" },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(finalAudioUrl);
    } catch {
      return NextResponse.json(
        { error: "Invalid audio URL format" },
        { status: 400 }
      );
    }

    // Update sermon with audio URL
    const { data: updatedSermon, error: updateError } = await supabase
      .from("sermons")
      .update({
        audio_url: finalAudioUrl,
        updated_at: new Date().toISOString(),
        // Clear error message and reset status if it was failed
        ...(body.clearError ? { error_message: null, status: "pending" } : {}),
      })
      .eq("id", sermonId)
      .select()
      .single();

    if (updateError) {
      console.error(`[UpdateAudio] Database error:`, updateError);
      return NextResponse.json(
        { error: `Database error: ${updateError.message}` },
        { status: 500 }
      );
    }

    console.log(`[UpdateAudio] ✅ Updated audio_url for sermon "${updatedSermon.title.substring(0, 50)}..."`);

    return NextResponse.json({
      success: true,
      sermon: updatedSermon,
      audioUrl: finalAudioUrl,
    });
  } catch (error) {
    console.error("Error updating audio URL:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
