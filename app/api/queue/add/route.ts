/**
 * API Route: Add Sermon to Transcription Queue
 * Adds a sermon to the global transcription queue
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

    const body = await request.json();
    const { sermonId } = body;

    if (!sermonId || typeof sermonId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid sermonId" },
        { status: 400 }
      );
    }

    // Check if sermon exists
    const { data: sermon, error: fetchError } = await supabase
      .from("sermons")
      .select("id, title, status, transcript, audio_url, youtube_url")
      .eq("id", sermonId)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching sermon:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch sermon", details: fetchError.message },
        { status: 500 }
      );
    }

    if (!sermon) {
      return NextResponse.json(
        { error: `Sermon with ID "${sermonId}" not found` },
        { status: 404 }
      );
    }

    // Check if transcript already exists
    if (sermon.transcript && sermon.transcript.trim().length > 100) {
      return NextResponse.json({
        success: true,
        message: "Transcript already exists",
        queueItem: null,
      });
    }

    // Check if sermon has audio source
    if (!sermon.audio_url && !sermon.youtube_url) {
      return NextResponse.json(
        {
          error: "Sermon has no audio_url or youtube_url. Cannot add to queue.",
        },
        { status: 400 }
      );
    }

    // Check if already in queue
    const { data: existingQueueItem } = await supabase
      .from("transcription_queue")
      .select("*")
      .eq("sermon_id", sermonId)
      .maybeSingle();

    if (existingQueueItem) {
      // Return existing queue item
      return NextResponse.json({
        success: true,
        message: "Sermon already in queue",
        queueItem: existingQueueItem,
      });
    }

    // Get next position in queue
    const { data: positionData, error: positionError } = await supabase.rpc(
      "get_next_queue_position"
    );

    if (positionError) {
      console.error("Error getting next position:", positionError);
      // Fallback: count existing items
      const { count } = await supabase
        .from("transcription_queue")
        .select("*", { count: "exact", head: true });
      const position = (count || 0) + 1;

      // Insert into queue
      const { data: queueItem, error: insertError } = await supabase
        .from("transcription_queue")
        .insert({
          sermon_id: sermonId,
          status: "queued",
          position: position,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error adding to queue:", insertError);
        return NextResponse.json(
          { error: "Failed to add to queue", details: insertError.message },
          { status: 500 }
        );
      }

      // Update sermon status
      await supabase
        .from("sermons")
        .update({
          status: "generating",
          progress_json: {
            step: "queued",
            message: `Queued for transcription (position ${position} in queue)...`,
            position: position,
          },
        })
        .eq("id", sermonId);

      return NextResponse.json({
        success: true,
        message: "Added to transcription queue",
        queueItem: queueItem,
      });
    }

    const position = positionData || 1;

    // Insert into queue
    const { data: queueItem, error: insertError } = await supabase
      .from("transcription_queue")
      .insert({
        sermon_id: sermonId,
        status: "queued",
        position: position,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error adding to queue:", insertError);
      return NextResponse.json(
        { error: "Failed to add to queue", details: insertError.message },
        { status: 500 }
      );
    }

    // Update sermon status
    await supabase
      .from("sermons")
      .update({
        status: "generating",
        progress_json: {
          step: "queued",
          message: `Queued for transcription (position ${position} in queue)...`,
          position: position,
        },
      })
      .eq("id", sermonId);

    return NextResponse.json({
      success: true,
      message: "Added to transcription queue",
      queueItem: queueItem,
    });
  } catch (error) {
    console.error("Error adding to queue:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
