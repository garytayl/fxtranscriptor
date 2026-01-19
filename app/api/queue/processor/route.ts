/**
 * API Route: Queue Processor
 * Processes the next item in the transcription queue
 * This should be called periodically (e.g., every 10 seconds) to process queued items
 * Only one sermon is processed at a time globally
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    let supabaseClient: ReturnType<typeof createSupabaseAdminClient>;
    try {
      supabaseClient = createSupabaseAdminClient();
    } catch (error) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    // Get the app URL - try multiple sources
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

    // Get next item to process (or currently processing item)
    const processResponse = await fetch(`${appUrl}/api/queue/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!processResponse.ok) {
      const errorData = await processResponse.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: "Failed to get next queue item",
          details: errorData.error || processResponse.statusText,
        },
        { status: 500 }
      );
    }

    const processData = await processResponse.json();

    if (!processData.processing || !processData.sermon) {
      // No items to process
      return NextResponse.json({
        success: true,
        message: "No items in queue",
        processed: false,
      });
    }

    const { sermon, queueItem } = processData;

    // Check if worker is configured
    const workerUrl = process.env.AUDIO_WORKER_URL?.trim();
    if (!workerUrl) {
      // Mark as failed
      await supabaseClient
        .from("transcription_queue")
        .update({
          status: "failed",
          error_message: "Worker service not configured (AUDIO_WORKER_URL missing)",
          completed_at: new Date().toISOString(),
        })
        .eq("id", queueItem.id);

      await supabaseClient
        .from("sermons")
        .update({
          status: "failed",
          error_message: "Worker service not configured",
        })
        .eq("id", sermon.id);

      return NextResponse.json({
        success: false,
        error: "Worker service not configured",
        processed: false,
      });
    }

    // Determine audio source
    const audioSource = sermon.audio_url || sermon.youtube_url;
    if (!audioSource) {
      // Mark as failed
      await supabaseClient
        .from("transcription_queue")
        .update({
          status: "failed",
          error_message: "No audio_url or youtube_url available",
          completed_at: new Date().toISOString(),
        })
        .eq("id", queueItem.id);

      await supabaseClient
        .from("sermons")
        .update({
          status: "failed",
          error_message: "No audio_url or youtube_url available",
        })
        .eq("id", sermon.id);

      return NextResponse.json({
        success: false,
        error: "No audio source available",
        processed: false,
      });
    }

    // Check if already cancelled
    const { data: currentQueueItem } = await supabaseClient
      .from("transcription_queue")
      .select("status")
      .eq("id", queueItem.id)
      .single();

    if (currentQueueItem?.status === "cancelled") {
      // Was cancelled, don't process
      return NextResponse.json({
        success: true,
        message: "Queue item was cancelled",
        processed: false,
      });
    }

    // Call worker to transcribe
    const cleanWorkerUrl = workerUrl.replace(/\/$/, "");
    console.log(`[Queue Processor] Calling worker: ${cleanWorkerUrl}/transcribe`);
    console.log(`[Queue Processor] Sermon: ${sermon.id} - ${sermon.title}`);

    try {
      // Fire and forget - worker will process asynchronously
      // Worker will call /api/queue/complete when done
      const workerResponse = await fetch(`${cleanWorkerUrl}/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sermonId: sermon.id,
          audioUrl: audioSource,
        }),
        // Short timeout just to verify connection
        signal: AbortSignal.timeout(10000),
      });

      if (!workerResponse.ok) {
        const errorText = await workerResponse.text().catch(() => "Unknown error");
        throw new Error(`Worker error: ${workerResponse.status} ${errorText}`);
      }

      console.log(`[Queue Processor] ✅ Worker accepted transcription request`);

      return NextResponse.json({
        success: true,
        message: "Transcription started by worker",
        processed: true,
        sermonId: sermon.id,
      });
    } catch (error) {
      console.error(`[Queue Processor] Error calling worker:`, error);

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Mark as failed
      await supabaseClient
        .from("transcription_queue")
        .update({
          status: "failed",
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq("id", queueItem.id);

      await supabaseClient
        .from("sermons")
        .update({
          status: "failed",
          error_message: errorMessage,
        })
        .eq("id", sermon.id);

      return NextResponse.json({
        success: false,
        error: errorMessage,
        processed: false,
      });
    }
  } catch (error) {
    console.error("Error in queue processor:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
