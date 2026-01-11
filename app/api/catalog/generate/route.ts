/**
 * API Route: Generate Transcript for a Sermon
 * Generates transcript for a specific sermon and stores it in the database
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { transcribeWithWhisper } from "@/lib/transcribeWithWhisper";

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
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching sermon:", fetchError);
      if (fetchError.message.includes("relation") || fetchError.message.includes("does not exist")) {
        return NextResponse.json(
          { 
            error: "Database tables not found. Please run the schema.sql file in your Supabase SQL Editor first.",
            details: fetchError.message
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { 
          error: "Failed to fetch sermon",
          details: fetchError.message
        },
        { status: 500 }
      );
    }

    if (!sermon) {
      return NextResponse.json(
        { error: `Sermon with ID "${sermonId}" not found. Try syncing the catalog first.` },
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

    // Check if sermon has any way to generate transcript (audio_url is primary, URLs are secondary)
    if (!sermon.audio_url && !sermon.youtube_url && !sermon.podbean_url) {
      const errorMessage = "No audio_url, YouTube URL, or Podbean URL available for this sermon. Cannot generate transcript.\n\nTo fix: Re-sync the catalog to populate audio_url from Podbean RSS feed.";
      
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
        { status: 200 } // 200 because request was successful, just no transcript available
      );
    }

    // SINGLE METHOD: Whisper AI transcription via Hugging Face (deterministic, reliable)
    // No fallbacks to unreliable YouTube/Podbean transcript extraction
    let transcriptResult = null;
    let transcriptSource: string | null = null;

    // Check if we have audio_url (required for Whisper AI)
    if (!sermon.audio_url) {
      const errorMessage = `No audio_url available for this sermon. Cannot generate transcript.\n\n`;
      + `Sermon URLs:\n`;
      + `• YouTube: ${sermon.youtube_url || 'none'}\n`;
      + `• Podbean: ${sermon.podbean_url || 'none'}\n`;
      + `• Audio: ${sermon.audio_url || 'none'}\n\n`;
      + `To fix:\n`;
      + `1. Re-sync the catalog to match this sermon with a Podbean episode (date-based matching)\n`;
      + `2. Check if Podbean RSS feed has <enclosure url="..."> for this episode\n`;
      + `3. If this is a YouTube-only sermon, YouTube audio extraction would be needed (future feature)`;
      
      console.log(`[Generate] ❌ Cannot generate transcript: ${errorMessage}`);
      
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
        { status: 200 }
      );
    }

    // Use Whisper AI (Hugging Face) - the only transcription method
    console.log(`[Generate] 🎯 Generating transcript using Whisper AI (Hugging Face) for: ${sermon.audio_url.substring(0, 100)}...`);
    
    const huggingFaceKey = process.env.HUGGINGFACE_API_KEY;
    if (!huggingFaceKey || huggingFaceKey.trim().length === 0) {
      const errorMessage = `Hugging Face API key not configured (HUGGINGFACE_API_KEY missing).\n\n`;
      + `See HUGGINGFACE_SETUP.md for setup instructions:\n`;
      + `1. Get token at https://huggingface.co/settings/tokens\n`;
      + `2. Enable "Make calls to Inference Providers" permission\n`;
      + `3. Add to Vercel environment variables`;
      
      console.log(`[Generate] ❌ ${errorMessage}`);
      
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
        { status: 200 }
      );
    }

    // Transcribe with Whisper AI
    try {
      const whisperResult = await transcribeWithWhisper(sermon.audio_url, huggingFaceKey);
      
      if (whisperResult.success && whisperResult.transcript.trim().length > 100) {
        console.log(`[Generate] ✅ Whisper AI transcription succeeded (${whisperResult.transcript.length} chars)`);
        transcriptResult = {
          success: true,
          transcript: whisperResult.transcript,
          source: "generated" as const,
        };
        transcriptSource = "generated";
      } else {
        const errorMessage = whisperResult.error || "Whisper AI transcription returned empty result";
        console.log(`[Generate] ❌ Whisper AI transcription failed: ${errorMessage}`);
        transcriptResult = {
          success: false,
          transcript: "",
          error: errorMessage,
        };
      }
    } catch (whisperError) {
      const errorMessage = `Whisper AI transcription error: ${whisperError instanceof Error ? whisperError.message : "Unknown error"}`;
      console.error(`[Generate] ❌ ${errorMessage}`);
      transcriptResult = {
        success: false,
        transcript: "",
        error: errorMessage,
      };
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
      // Whisper AI transcription failed - provide helpful error message
      const errorMessage = transcriptResult?.error || 'Whisper AI transcription failed.';
      
      console.log(`[Generate] Transcript generation failed for sermon "${sermon.title}": ${errorMessage}`);
      
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
        { status: 200 } // Changed from 404 to 200 - this is a valid response, just no transcript found
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
