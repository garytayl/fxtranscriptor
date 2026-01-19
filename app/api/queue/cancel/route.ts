/**
 * API Route: Cancel Transcription Queue Item
 * Cancels a sermon in the transcription queue
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

    const body = await request.json();
    const { sermonId } = body;

    if (!sermonId || typeof sermonId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid sermonId" },
        { status: 400 }
      );
    }

    // Find queue item
    const { data: queueItem, error: fetchError } = await supabaseClient
      .from("transcription_queue")
      .select("*")
      .eq("sermon_id", sermonId)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching queue item:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch queue item", details: fetchError.message },
        { status: 500 }
      );
    }

    if (!queueItem) {
      return NextResponse.json(
        { error: "Sermon not found in queue" },
        { status: 404 }
      );
    }

    // If already processing, mark as cancelled (worker will check this)
    if (queueItem.status === "processing") {
      // Update queue item
      await supabaseClient
        .from("transcription_queue")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", queueItem.id);

      // Update sermon status and progress to indicate cancellation
      await supabaseClient
        .from("sermons")
        .update({
          status: "pending",
          progress_json: {
            step: "cancelled",
            message: "Transcription cancelled by user",
          },
        })
        .eq("id", sermonId);

      return NextResponse.json({
        success: true,
        message: "Transcription cancelled. Worker will stop processing when it checks the status.",
      });
    }

    // If queued (not yet processing), remove from queue
    if (queueItem.status === "queued") {
      // Delete from queue
      await supabaseClient
        .from("transcription_queue")
        .delete()
        .eq("id", queueItem.id);

      // Reorder remaining items
      const { data: remainingItems } = await supabaseClient
        .from("transcription_queue")
        .select("*")
        .eq("status", "queued")
        .order("position", { ascending: true });

      // Update positions
      if (remainingItems && remainingItems.length > 0) {
        for (let i = 0; i < remainingItems.length; i++) {
          await supabaseClient
            .from("transcription_queue")
            .update({ position: i + 1 })
            .eq("id", remainingItems[i].id);
        }
      }

      // Update sermon status
      await supabaseClient
        .from("sermons")
        .update({
          status: "pending",
          progress_json: null,
        })
        .eq("id", sermonId);

      return NextResponse.json({
        success: true,
        message: "Removed from transcription queue",
      });
    }

    // Already completed, failed, or cancelled
    return NextResponse.json(
      {
        error: `Cannot cancel: sermon is ${queueItem.status}`,
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error cancelling queue item:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
