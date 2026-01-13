/**
 * API Route: List Transcription Queue
 * Returns the current state of the transcription queue
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    // Get all queue items with sermon details
    const { data: queueItems, error: queueError } = await supabase
      .from("transcription_queue")
      .select(
        `
        *,
        sermons (
          id,
          title,
          date,
          audio_url,
          youtube_url,
          status,
          progress_json
        )
      `
      )
      .order("position", { ascending: true });

    if (queueError) {
      console.error("Error fetching queue:", queueError);
      return NextResponse.json(
        { error: "Failed to fetch queue", details: queueError.message },
        { status: 500 }
      );
    }

    // Format response
    const formattedQueue = (queueItems || []).map((item: any) => ({
      id: item.id,
      sermonId: item.sermon_id,
      status: item.status,
      position: item.position,
      createdAt: item.created_at,
      startedAt: item.started_at,
      completedAt: item.completed_at,
      errorMessage: item.error_message,
      sermon: item.sermons,
    }));

    // Get currently processing item
    const processing = formattedQueue.find((item) => item.status === "processing");
    
    // Get queued items (not processing, not completed, not failed, not cancelled)
    const queued = formattedQueue.filter(
      (item) =>
        item.status === "queued" &&
        item.id !== processing?.id
    );

    return NextResponse.json({
      success: true,
      queue: {
        processing: processing || null,
        queued: queued,
        all: formattedQueue,
      },
    });
  } catch (error) {
    console.error("Error listing queue:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
