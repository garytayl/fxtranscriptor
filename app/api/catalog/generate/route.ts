/**
 * API Route: Generate Transcript for a Sermon
 * Generates transcript for a specific sermon and stores it in the database
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { transcribeWithWhisper } from "@/lib/transcribeWithWhisper";
import { transcribeChunks } from "@/lib/transcribeChunks";

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

    // Check file size to determine if chunking is needed
    const CHUNKING_THRESHOLD_MB = 20; // Files >20MB must be chunked
    
    // First, try to get file size from HEAD request (if supported)
    let fileSizeMB = 0;
    try {
      const headResponse = await fetch(sermon.audio_url, { method: "HEAD" });
      const contentLength = headResponse.headers.get("content-length");
      if (contentLength) {
        fileSizeMB = parseInt(contentLength) / 1024 / 1024;
        console.log(`[Generate] Audio file size: ${fileSizeMB.toFixed(2)} MB (from Content-Length header)`);
      }
    } catch (error) {
      console.log(`[Generate] Could not determine file size from HEAD request, will check after download if needed`);
    }

    const huggingFaceKey = process.env.HUGGINGFACE_API_KEY;
    if (!huggingFaceKey || huggingFaceKey.trim().length === 0) {
      const errorMessage = `Hugging Face API key not configured (HUGGINGFACE_API_KEY missing).\n\n` +
        `See HUGGINGFACE_SETUP.md for setup instructions:\n` +
        `1. Get token at https://huggingface.co/settings/tokens\n` +
        `2. Enable "Make calls to Inference Providers" permission\n` +
        `3. Add to Vercel environment variables`;
      
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

    // Use chunking for large files (>20MB), single transcription for smaller files
    if (fileSizeMB > CHUNKING_THRESHOLD_MB || fileSizeMB === 0) {
      // File is large or size unknown - use chunking pipeline
      console.log(`[Generate] 🎯 File is ${fileSizeMB > 0 ? fileSizeMB.toFixed(2) + ' MB' : 'unknown size'}, using chunking pipeline`);
      
      try {
        // Step 1: Call chunking worker service
        const workerUrl = process.env.AUDIO_WORKER_URL;
        if (!workerUrl) {
          throw new Error("AUDIO_WORKER_URL not configured. Set environment variable to worker service URL.");
        }
        
        const chunkResponse = await fetch(`${workerUrl}/chunk`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ audioUrl: sermon.audio_url }),
        });

        if (!chunkResponse.ok) {
          const chunkError = await chunkResponse.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(`Chunking failed: ${chunkError.error || chunkResponse.statusText}`);
        }

        const chunkData = await chunkResponse.json();
        
        if (!chunkData.success || !chunkData.chunks || chunkData.chunks.length === 0) {
          throw new Error("No chunks returned from worker service");
        }

        console.log(`[Generate] ✅ Audio chunked into ${chunkData.chunks.length} chunks`);

        // Step 2: Transcribe each chunk
        const chunks = chunkData.chunks;
        console.log(`[Generate] Starting transcription of ${chunks.length} chunks...`);
        
        const chunksResult = await transcribeChunks(
          chunks,
          huggingFaceKey,
          (chunkNum, totalChunks) => {
            console.log(`[Generate] Progress: Chunk ${chunkNum}/${totalChunks} completed`);
          }
        );

        if (chunksResult.success && chunksResult.transcript.trim().length > 100) {
          console.log(`[Generate] ✅ All chunks transcribed successfully (${chunksResult.transcript.length} chars total)`);
          transcriptResult = {
            success: true,
            transcript: chunksResult.transcript,
            source: "generated" as const,
          };
          transcriptSource = "generated";
        } else {
          const errorMessage = chunksResult.error || "Chunk transcription returned empty result";
          console.log(`[Generate] ❌ Chunk transcription failed: ${errorMessage}`);
          transcriptResult = {
            success: false,
            transcript: "",
            error: errorMessage,
          };
        }
      } catch (chunkError) {
        const errorMessage = `Chunking pipeline error: ${chunkError instanceof Error ? chunkError.message : "Unknown error"}`;
        console.error(`[Generate] ❌ ${errorMessage}`);
        
        // If chunking fails and file might be small enough, try direct transcription as fallback
        if (fileSizeMB > 0 && fileSizeMB <= CHUNKING_THRESHOLD_MB * 1.5) {
          console.log(`[Generate] Chunking failed but file might be small enough, trying direct transcription...`);
          // Fall through to direct transcription below
        } else {
          transcriptResult = {
            success: false,
            transcript: "",
            error: errorMessage,
          };
        }
      }
    }

    // Use direct transcription for smaller files or if chunking was skipped
    if (!transcriptResult || !transcriptResult.success) {
      console.log(`[Generate] 🎯 Using direct Whisper AI transcription for: ${sermon.audio_url.substring(0, 100)}...`);
      
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
