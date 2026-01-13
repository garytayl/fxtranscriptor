/**
 * API Route: Process Next Item in Queue
 * Gets the next item from the queue and marks it as processing
 * This is called by the queue processor to get the next sermon to transcribe
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    // Check if there's already a processing item
    const { data: processingItem } = await supabase
      .from("transcription_queue")
      .select("*")
      .eq("status", "processing")
      .maybeSingle();

    if (processingItem) {
      // Return the currently processing item
      const { data: sermon } = await supabase
        .from("sermons")
        .select("*")
        .eq("id", processingItem.sermon_id)
        .single();

      return NextResponse.json({
        success: true,
        processing: true,
        queueItem: processingItem,
        sermon: sermon,
      });
    }

    // Get next queued item (lowest position, status = 'queued')
    const { data: nextItem, error: fetchError } = await supabase
      .from("transcription_queue")
      .select("*")
      .eq("status", "queued")
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching next queue item:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch queue", details: fetchError.message },
        { status: 500 }
      );
    }

    if (!nextItem) {
      // No items in queue
      return NextResponse.json({
        success: true,
        processing: false,
        queueItem: null,
        sermon: null,
      });
    }

    // Mark as processing
    const { data: updatedItem, error: updateError } = await supabase
      .from("transcription_queue")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .eq("id", nextItem.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating queue item:", updateError);
      return NextResponse.json(
        { error: "Failed to update queue item", details: updateError.message },
        { status: 500 }
      );
    }

    // Get sermon details
    const { data: sermon, error: sermonError } = await supabase
      .from("sermons")
      .select("*")
      .eq("id", nextItem.sermon_id)
      .single();

    if (sermonError) {
      console.error("Error fetching sermon:", sermonError);
      return NextResponse.json(
        { error: "Failed to fetch sermon", details: sermonError.message },
        { status: 500 }
      );
    }

    // Update sermon progress
    await supabase
      .from("sermons")
      .update({
        status: "generating",
        progress_json: {
          step: "processing",
          message: "Transcription in progress...",
          position: 1, // Currently processing
        },
      })
      .eq("id", nextItem.sermon_id);

    return NextResponse.json({
      success: true,
      processing: true,
      queueItem: updatedItem,
      sermon: sermon,
    });
  } catch (error) {
    console.error("Error processing queue:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
