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
    let position = 1;
    const { data: positionData, error: positionError } = await supabase.rpc(
      "get_next_queue_position"
    );

    if (positionError) {
      console.error("[Queue Add] Error getting next position via RPC:", positionError);
      console.error("[Queue Add] RPC Error details:", JSON.stringify(positionError, null, 2));
      
      // Check if table exists first
      const { error: tableCheckError } = await supabase
        .from("transcription_queue")
        .select("id")
        .limit(1);
      
      if (tableCheckError) {
        console.error("[Queue Add] Table check error:", tableCheckError);
        if (tableCheckError.message.includes("relation") || tableCheckError.message.includes("does not exist")) {
          return NextResponse.json(
            { 
              error: "Transcription queue table not found. Please run the migration_add_transcription_queue.sql file in your Supabase SQL Editor first.",
              details: tableCheckError.message,
              migrationFile: "supabase/migration_add_transcription_queue.sql"
            },
            { status: 500 }
          );
        }
        return NextResponse.json(
          { 
            error: "Database error checking queue table", 
            details: tableCheckError.message 
          },
          { status: 500 }
        );
      }
      
      // Fallback: count existing items
      const { count, error: countError } = await supabase
        .from("transcription_queue")
        .select("*", { count: "exact", head: true });
      
      if (countError) {
        console.error("[Queue Add] Error counting queue items:", countError);
        return NextResponse.json(
          { 
            error: "Failed to count queue items", 
            details: countError.message 
          },
          { status: 500 }
        );
      }
      
      position = (count || 0) + 1;
      console.log(`[Queue Add] Using fallback position calculation: ${position}`);
    } else {
      position = positionData || 1;
      console.log(`[Queue Add] Using RPC position: ${position}`);
    }

    // Insert into queue
    console.log(`[Queue Add] Inserting sermon ${sermonId} into queue at position ${position}`);
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
      console.error("[Queue Add] Error inserting into queue:", insertError);
      console.error("[Queue Add] Insert error details:", JSON.stringify(insertError, null, 2));
      
      // Check for specific error types
      if (insertError.message.includes("relation") || insertError.message.includes("does not exist")) {
        return NextResponse.json(
          { 
            error: "Transcription queue table not found. Please run the migration_add_transcription_queue.sql file in your Supabase SQL Editor first.",
            details: insertError.message,
            migrationFile: "supabase/migration_add_transcription_queue.sql"
          },
          { status: 500 }
        );
      }
      
      if (insertError.message.includes("violates unique constraint") || insertError.message.includes("duplicate")) {
        // Already in queue, fetch it
        const { data: existingItem } = await supabase
          .from("transcription_queue")
          .select("*")
          .eq("sermon_id", sermonId)
          .single();
        
        if (existingItem) {
          return NextResponse.json({
            success: true,
            message: "Sermon already in queue",
            queueItem: existingItem,
          });
        }
      }
      
      return NextResponse.json(
        { 
          error: "Failed to add to queue", 
          details: insertError.message,
          code: insertError.code,
          hint: insertError.hint
        },
        { status: 500 }
      );
    }
    
    console.log(`[Queue Add] Successfully added to queue:`, queueItem);

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
    console.error("[Queue Add] Unexpected error:", error);
    console.error("[Queue Add] Error stack:", error instanceof Error ? error.stack : "No stack trace");
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}
