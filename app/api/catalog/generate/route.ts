/**
 * API Route: Generate Transcript for a Sermon
 * Generates transcript for a specific sermon and stores it in the database
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchTranscript } from "@/lib/fetchTranscript";
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

    // Try to fetch transcript from available sources
    // NEW PRIORITY: audio_url → Whisper AI FIRST (most reliable), then optional transcript extraction
    let transcriptResult = null;
    let transcriptSource: string | null = null;
    const attemptedUrls: string[] = [];

    // 🥇 PRIORITY 1: Whisper AI transcription (if audio_url exists - MOST RELIABLE)
    // This is the primary path - transcripts from YouTube/Podbean are just optimizations
    if (sermon.audio_url) {
      console.log(`[Generate] 🎯 Priority 1: Attempting Whisper AI transcription for: ${sermon.audio_url.substring(0, 100)}...`);
      attemptedUrls.push(`Whisper AI: ${sermon.audio_url.substring(0, 50)}...`);
      
      const huggingFaceKey = process.env.HUGGINGFACE_API_KEY;
      if (!huggingFaceKey || huggingFaceKey.trim().length === 0) {
        console.log(`[Generate] Whisper AI not configured (HUGGINGFACE_API_KEY missing). Will try transcript extraction as fallback.`);
      } else {
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
            console.log(`[Generate] Whisper AI transcription failed: ${whisperResult.error || "No transcript"}. Will try transcript extraction as fallback.`);
            transcriptResult = {
              success: false,
              transcript: "",
              error: whisperResult.error || "Whisper AI transcription failed",
            };
          }
        } catch (whisperError) {
          console.error(`[Generate] Whisper AI transcription error:`, whisperError);
          console.log(`[Generate] Will try transcript extraction as fallback.`);
          transcriptResult = {
            success: false,
            transcript: "",
            error: `Whisper AI transcription failed: ${whisperError instanceof Error ? whisperError.message : "Unknown error"}`,
          };
        }
      }
    } else {
      console.log(`[Generate] ⚠️ No audio_url available. Sermon URLs - YouTube: ${sermon.youtube_url || 'none'}, Podbean: ${sermon.podbean_url || 'none'}, Audio: ${sermon.audio_url || 'none'}`);
      console.log(`[Generate] Will attempt transcript extraction as fallback (less reliable).`);
    }

    // 🥈 PRIORITY 2: Try YouTube transcript extraction (OPTIONAL - only if Whisper failed or no audio_url)
    // This is a fast optimization when it works, but unreliable for many videos
    if (!transcriptResult?.success && sermon.youtube_url) {
      console.log(`[Generate] 🥈 Priority 2: Attempting YouTube transcript extraction (optional optimization): ${sermon.youtube_url}`);
      attemptedUrls.push(`YouTube: ${sermon.youtube_url}`);
      try {
        const youtubeResult = await fetchTranscript(sermon.youtube_url);
        if (youtubeResult.success && youtubeResult.transcript.trim().length > 100) {
          transcriptSource = youtubeResult.source || "youtube";
          console.log(`[Generate] ✅ YouTube transcript extracted successfully (${youtubeResult.transcript.length} chars) - used as optimization`);
          transcriptResult = youtubeResult;
        } else {
          console.log(`[Generate] YouTube transcript extraction failed (expected for many videos): ${youtubeResult.error || "Transcript disabled on video"}`);
        }
      } catch (youtubeError) {
        console.log(`[Generate] YouTube extraction error (non-critical):`, youtubeError);
        // Don't set transcriptResult here - let it fail through to next attempt
      }
    }

    // 🥉 PRIORITY 3: Try Podbean transcript extraction (OPTIONAL - only if both above failed)
    if (!transcriptResult?.success && sermon.podbean_url) {
      console.log(`[Generate] 🥉 Priority 3: Attempting Podbean transcript extraction (optional optimization): ${sermon.podbean_url}`);
      attemptedUrls.push(`Podbean: ${sermon.podbean_url}`);
      try {
        const podbeanResult = await fetchTranscript(sermon.podbean_url);
        if (podbeanResult.success && podbeanResult.transcript.trim().length > 100) {
          transcriptSource = podbeanResult.source || "podbean";
          console.log(`[Generate] ✅ Podbean transcript extracted successfully (${podbeanResult.transcript.length} chars) - used as optimization`);
          transcriptResult = podbeanResult;
        } else {
          console.log(`[Generate] Podbean transcript extraction failed: ${podbeanResult.error || "No transcript found in Podbean metadata"}`);
        }
      } catch (podbeanError) {
        console.log(`[Generate] Podbean extraction error (non-critical):`, podbeanError);
        // Don't set transcriptResult here - let it fail through
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
      const attemptedSources = attemptedUrls.length > 0 ? `\n\nAttempted sources:\n${attemptedUrls.map(u => `• ${u}`).join('\n')}` : '';
      const errorMessage = transcriptResult?.error || `Failed to extract transcript from available sources.${attemptedSources}`;
      
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
          attemptedUrls,
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
