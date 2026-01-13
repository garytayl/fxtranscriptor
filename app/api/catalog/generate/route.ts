/**
 * API Route: Generate Transcript for a Sermon
 * Generates transcript for a specific sermon and stores it in the database
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { transcribeWithWhisper } from "@/lib/transcribeWithWhisper";
import { transcribeChunks } from "@/lib/transcribeChunks";
import { extractMetadata } from "@/lib/extractMetadata";

export const runtime = "nodejs";

// Helper function to update progress in database
async function updateProgress(
  sermonId: string,
  progress: { step: string; current?: number; total?: number; message?: string; details?: string[] }
) {
  if (!supabase) return;
  try {
    await supabase
      .from("sermons")
      .update({ progress_json: progress })
      .eq("id", sermonId);
  } catch (error) {
    console.error(`[Generate] Error updating progress:`, error);
  }
}

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

    // Check if Railway worker is configured - if so, delegate to it
    const workerUrl = process.env.AUDIO_WORKER_URL?.trim();
    
    console.log(`[Generate] Worker URL configured: ${workerUrl ? 'YES (' + workerUrl.substring(0, 50) + '...)' : 'NO'}`);
    console.log(`[Generate] Sermon has audio_url: ${sermon.audio_url ? 'YES' : 'NO'}`);
    console.log(`[Generate] Sermon has youtube_url: ${sermon.youtube_url ? 'YES (' + sermon.youtube_url.substring(0, 50) + '...)' : 'NO'}`);
    
    // Determine audio source: prefer audio_url, fallback to YouTube URL
    let audioSource = sermon.audio_url;
    if (!audioSource && sermon.youtube_url) {
      // Use YouTube URL as fallback if no direct audio URL
      audioSource = sermon.youtube_url;
      console.log(`[Generate] ✅ No audio_url found, using YouTube URL for transcription: ${sermon.youtube_url}`);
    }
    
    // If we have a YouTube URL but no worker, show helpful error
    if (!workerUrl && sermon.youtube_url && !sermon.audio_url) {
      const errorMessage = `YouTube audio extraction requires the worker service.\n\n` +
        `Please set AUDIO_WORKER_URL in Vercel environment variables to your Railway worker URL.\n\n` +
        `Your Railway worker URL should look like: https://your-worker.railway.app\n\n` +
        `Alternatively, run the merge script to match this sermon with a Podbean episode to get an audio_url.`;
      
      console.log(`[Generate] ❌ Worker not configured for YouTube transcription`);
      
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
    
    if (workerUrl && audioSource) {
      console.log(`[Generate] ✅ Delegating transcription to Railway worker for sermon ${sermonId}`);
      console.log(`[Generate] Worker URL: ${workerUrl}`);
      console.log(`[Generate] Audio source: ${audioSource.substring(0, 100)}...`);
      
      // Update status to "generating"
      await supabase
        .from("sermons")
        .update({ status: "generating", progress_json: { step: "queued", message: "Queued for transcription..." } })
        .eq("id", sermonId);

      // Ensure worker URL doesn't have trailing slash
      const cleanWorkerUrl = workerUrl.replace(/\/$/, '');
      
      // Trigger worker - use shorter timeout just to verify connection, then fire-and-forget
      console.log(`[Generate] Calling worker: ${cleanWorkerUrl}/transcribe`);
      console.log(`[Generate] Payload: { sermonId: ${sermonId}, audioUrl: ${audioSource.substring(0, 80)}... }`);
      
      // Short timeout just to verify worker is reachable (10 seconds)
      // After that, we fire-and-forget - worker will process asynchronously
      const connectionTimeout = 10000; // 10 seconds to verify connection
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), connectionTimeout);
      
      try {
        const workerResponse = await fetch(`${cleanWorkerUrl}/transcribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sermonId: sermonId,
            audioUrl: audioSource, // Can be Podbean audio URL or YouTube URL
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!workerResponse.ok) {
          const errorText = await workerResponse.text().catch(() => 'Unknown error');
          console.error(`[Generate] Worker returned error ${workerResponse.status}: ${errorText}`);
          throw new Error(`Worker error: ${workerResponse.status} ${errorText}`);
        }
        
        console.log(`[Generate] ✅ Worker accepted request (status: ${workerResponse.status}) - processing will continue in background`);
        
        // Return immediately - worker will update database asynchronously
        // Don't wait for transcription to complete - it can take many minutes
        return NextResponse.json({
          success: true,
          message: "Transcription started. This may take several minutes. The page will auto-refresh to show progress.",
          sermon: {
            ...sermon,
            status: "generating",
          },
        });
      } catch (error) {
        clearTimeout(timeoutId);
        console.error(`[Generate] ❌ Error triggering worker:`, error);
        
        // Only fail if it's a connection error, not a timeout
        const errorMessage = error instanceof Error 
          ? error.message 
          : "Unknown error";
        
        const isConnectionError = errorMessage.includes("ECONNREFUSED") || 
                                  errorMessage.includes("ENOTFOUND") ||
                                  errorMessage.includes("NetworkError");
        
        // If it's just a timeout but worker might be processing, don't mark as failed
        // The worker might have accepted the request before the timeout
        if (errorMessage.includes("aborted") && !isConnectionError) {
          console.log(`[Generate] ⚠️  Connection timeout, but worker may have accepted request - checking status...`);
          
          // Check if worker actually started processing by checking sermon status
          // Give it a moment, then check
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const { data: updatedSermon } = await supabase
            .from("sermons")
            .select("status, progress_json")
            .eq("id", sermonId)
            .single();
          
          // If status is generating or has progress, worker is working
          if (updatedSermon && (updatedSermon.status === "generating" || updatedSermon.progress_json)) {
            console.log(`[Generate] ✅ Worker is processing (status: ${updatedSermon.status}) - timeout was false alarm`);
            return NextResponse.json({
              success: true,
              message: "Transcription started. This may take several minutes. The page will auto-refresh to show progress.",
              sermon: updatedSermon,
            });
          }
        }
        
        // Real connection error - mark as failed
        const finalErrorMessage = isConnectionError
          ? `Worker service unreachable. Please check that ${cleanWorkerUrl} is running. Check Railway logs.`
          : `Failed to trigger worker: ${errorMessage}. Check that ${cleanWorkerUrl} is accessible.`;
        
        if (supabase) {
          try {
            await supabase
              .from("sermons")
              .update({ 
                status: "failed",
                error_message: finalErrorMessage,
                progress_json: null,
              })
              .eq("id", sermonId);
          } catch (err) {
            console.error(`[Generate] Error updating status:`, err);
          }
        }
        
        // Return error response
        return NextResponse.json({
          success: false,
          error: finalErrorMessage,
          sermon: {
            ...sermon,
            status: "failed",
            error_message: finalErrorMessage,
          },
        }, { status: 200 });
      }
    }

    // Fallback: Use Vercel transcription (for small files or if worker not configured)
    console.log(`[Generate] Using Vercel transcription (worker not configured or no audio_url)`);
    
    // Update status to "generating"
    await supabase
      .from("sermons")
      .update({ status: "generating", progress_json: { step: "initializing", message: "Initializing transcription..." } })
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

    // Check if we have audio_url or YouTube URL (required for Whisper AI)
    // Note: YouTube URLs require worker service for extraction
    if (!sermon.audio_url && !sermon.youtube_url) {
      const errorMessage = `No audio_url or YouTube URL available for this sermon. Cannot generate transcript.\n\n` +
        `Sermon URLs:\n` +
        `• YouTube: ${sermon.youtube_url || 'none'}\n` +
        `• Podbean: ${sermon.podbean_url || 'none'}\n` +
        `• Audio: ${sermon.audio_url || 'none'}\n\n` +
        `To fix:\n` +
        `1. Re-sync the catalog to match this sermon with a Podbean episode (date-based matching)\n` +
        `2. Check if Podbean RSS feed has <enclosure url="..."> for this episode\n` +
        `3. Ensure AUDIO_WORKER_URL is set in Vercel to enable YouTube audio extraction`;
      
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

    // For Vercel transcription, we can only use direct audio URLs (not YouTube)
    // YouTube extraction requires the worker service
    if (!sermon.audio_url && sermon.youtube_url) {
      const errorMessage = `YouTube audio extraction requires the worker service. Please set AUDIO_WORKER_URL in Vercel environment variables.\n\n` +
        `Alternatively, run the merge script to match this sermon with a Podbean episode to get an audio_url.`;
      
      console.log(`[Generate] ❌ Cannot extract YouTube audio on Vercel: ${errorMessage}`);
      
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
    
    await updateProgress(sermonId, { step: "checking_size", message: "Checking audio file size..." });
    
    // First, try to get file size from HEAD request (if supported)
    let fileSizeMB = 0;
    try {
      const headResponse = await fetch(sermon.audio_url, { method: "HEAD" });
      const contentLength = headResponse.headers.get("content-length");
      if (contentLength) {
        fileSizeMB = parseInt(contentLength) / 1024 / 1024;
        console.log(`[Generate] Audio file size: ${fileSizeMB.toFixed(2)} MB (from Content-Length header)`);
        await updateProgress(sermonId, { step: "checked_size", message: `Audio file size: ${fileSizeMB.toFixed(2)} MB` });
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
        await updateProgress(sermonId, { step: "chunked", message: `Audio chunked into ${chunkData.chunks.length} chunks`, total: chunkData.chunks.length });

        // Step 2: Transcribe each chunk
        const chunks = chunkData.chunks;
        console.log(`[Generate] Starting transcription of ${chunks.length} chunks...`);
        await updateProgress(sermonId, { step: "transcribing_chunks", message: "Starting transcription...", current: 0, total: chunks.length });
        
        const chunksResult = await transcribeChunks(
          chunks,
          huggingFaceKey,
          async (chunkNum, totalChunks) => {
            console.log(`[Generate] Progress: Chunk ${chunkNum}/${totalChunks} completed`);
            await updateProgress(sermonId, { step: "transcribing_chunks", message: `Transcribing chunk ${chunkNum}/${totalChunks}...`, current: chunkNum, total: totalChunks });
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
        const errorMessage = chunkError instanceof Error ? chunkError.message : "Unknown error";
        console.error(`[Generate] ❌ Chunking pipeline error: ${errorMessage}`);
        
        // If chunking fails because worker isn't configured, don't fall through to direct transcription
        // Large files (>20MB) MUST be chunked - direct transcription will fail
        if (errorMessage.includes("AUDIO_WORKER_URL not configured")) {
          const workerErrorMsg = `Audio file requires chunking (${fileSizeMB > 0 ? fileSizeMB.toFixed(2) + ' MB' : 'large file'}), but worker service is not configured.\n\n` +
            `To transcribe large files (>20MB), you need to:\n` +
            `1. Deploy the audio chunking worker service (see WORKER_SETUP.md)\n` +
            `2. Set AUDIO_WORKER_URL environment variable in Vercel\n` +
            `3. Create Supabase Storage bucket: sermon-chunks\n\n` +
            `Alternative: Wait for the worker service to be deployed, or use a paid transcription service.`;
          
          transcriptResult = {
            success: false,
            transcript: "",
            error: workerErrorMsg,
          };
        } else if (fileSizeMB > 0 && fileSizeMB <= CHUNKING_THRESHOLD_MB * 1.5) {
          // File might be small enough - try direct transcription as fallback
          console.log(`[Generate] Chunking failed but file might be small enough (${fileSizeMB.toFixed(2)} MB), trying direct transcription...`);
          // Fall through to direct transcription below
        } else {
          // File is definitely too large - don't try direct transcription
          transcriptResult = {
            success: false,
            transcript: "",
            error: `Chunking failed: ${errorMessage}. File is ${fileSizeMB > 0 ? fileSizeMB.toFixed(2) + ' MB' : 'too large'} and cannot be transcribed without chunking.`,
          };
        }
      }
    }

    // Use direct transcription for smaller files or if chunking was skipped
    if (!transcriptResult || !transcriptResult.success) {
      console.log(`[Generate] 🎯 Using direct Whisper AI transcription for: ${sermon.audio_url.substring(0, 100)}...`);
      await updateProgress(sermonId, { step: "transcribing", message: "Transcribing audio..." });
      
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
      // Extract metadata from transcript (series, speaker, summary)
      const metadata = extractMetadata(transcriptResult.transcript);
      
      const { data: updatedSermon, error: updateError } = await supabase
        .from("sermons")
        .update({
          transcript: transcriptResult.transcript.trim(),
          transcript_source: transcriptSource as any,
          transcript_generated_at: new Date().toISOString(),
          series: metadata.series,
          speaker: metadata.speaker,
          status: "completed",
          error_message: null,
          progress_json: null, // Clear progress on completion
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
          progress_json: null, // Clear progress on error
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
