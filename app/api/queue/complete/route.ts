/**
 * API Route: Mark Queue Item as Complete
 * Called by the worker after transcription completes (success or failure)
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
    const { sermonId, success, errorMessage } = body;

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
      // Queue item might have been deleted, that's okay
      return NextResponse.json({
        success: true,
        message: "Queue item not found (may have been deleted)",
      });
    }

    // Update queue item
    const updateData: any = {
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (success) {
      updateData.status = "completed";
    } else {
      updateData.status = "failed";
      if (errorMessage) {
        updateData.error_message = errorMessage;
      }
    }

    await supabaseClient
      .from("transcription_queue")
      .update(updateData)
      .eq("id", queueItem.id);

    // Reorder remaining queued items
    const { data: remainingItems } = await supabaseClient
      .from("transcription_queue")
      .select("*")
      .eq("status", "queued")
      .order("position", { ascending: true });

    if (remainingItems && remainingItems.length > 0) {
      for (let i = 0; i < remainingItems.length; i++) {
        await supabaseClient
          .from("transcription_queue")
          .update({ position: i + 1 })
          .eq("id", remainingItems[i].id);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Queue item marked as complete",
    });
  } catch (error) {
    console.error("Error completing queue item:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
