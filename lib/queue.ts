/**
 * Shared queue management functions
 * Used by both API routes to avoid HTTP calls between routes
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface AddToQueueResult {
  success: boolean;
  message?: string;
  queueItem?: any;
  error?: string;
  details?: string;
  migrationFile?: string;
}

/**
 * Add a sermon to the transcription queue
 */
export async function addSermonToQueue(sermonId: string): Promise<AddToQueueResult> {
  try {
    const supabase = createSupabaseAdminClient();

    // Check if sermon exists
    const { data: sermon, error: fetchError } = await supabase
      .from("sermons")
      .select("id, title, status, transcript, audio_url, youtube_url")
      .eq("id", sermonId)
      .maybeSingle();

    if (fetchError) {
      console.error("[Queue] Error fetching sermon:", fetchError);
      return {
        success: false,
        error: "Failed to fetch sermon",
        details: fetchError.message,
      };
    }

    if (!sermon) {
      return {
        success: false,
        error: `Sermon with ID "${sermonId}" not found`,
      };
    }

    // Check if transcript already exists
    if (sermon.transcript && sermon.transcript.trim().length > 100) {
      return {
        success: true,
        message: "Transcript already exists",
        queueItem: null,
      };
    }

    // Check if sermon has audio source
    if (!sermon.audio_url && !sermon.youtube_url) {
      return {
        success: false,
        error: "Sermon has no audio_url or youtube_url. Cannot add to queue.",
      };
    }

    // Check if already in queue
    const { data: existingQueueItem } = await supabase
      .from("transcription_queue")
      .select("*")
      .eq("sermon_id", sermonId)
      .maybeSingle();

    if (existingQueueItem) {
      // Return existing queue item
      return {
        success: true,
        message: "Sermon already in queue",
        queueItem: existingQueueItem,
      };
    }

    // Get next position in queue
    let position = 1;
    const { data: positionData, error: positionError } = await supabase.rpc(
      "get_next_queue_position"
    );

    if (positionError) {
      console.error("[Queue] Error getting next position via RPC:", positionError);
      console.error("[Queue] RPC Error details:", JSON.stringify(positionError, null, 2));
      
      // Check if table exists first
      const { error: tableCheckError } = await supabase
        .from("transcription_queue")
        .select("id")
        .limit(1);
      
      if (tableCheckError) {
        console.error("[Queue] Table check error:", tableCheckError);
        if (tableCheckError.message.includes("relation") || tableCheckError.message.includes("does not exist")) {
          return {
            success: false,
            error: "Transcription queue table not found. Please run the migration_add_transcription_queue.sql file in your Supabase SQL Editor first.",
            details: tableCheckError.message,
            migrationFile: "supabase/migration_add_transcription_queue.sql",
          };
        }
        return {
          success: false,
          error: "Database error checking queue table",
          details: tableCheckError.message,
        };
      }
      
      // Fallback: count existing items
      const { count, error: countError } = await supabase
        .from("transcription_queue")
        .select("*", { count: "exact", head: true });
      
      if (countError) {
        console.error("[Queue] Error counting queue items:", countError);
        return {
          success: false,
          error: "Failed to count queue items",
          details: countError.message,
        };
      }
      
      position = (count || 0) + 1;
      console.log(`[Queue] Using fallback position calculation: ${position}`);
    } else {
      position = positionData || 1;
      console.log(`[Queue] Using RPC position: ${position}`);
    }

    // Insert into queue
    console.log(`[Queue] Inserting sermon ${sermonId} into queue at position ${position}`);
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
      console.error("[Queue] Error inserting into queue:", insertError);
      console.error("[Queue] Insert error details:", JSON.stringify(insertError, null, 2));
      
      // Check for specific error types
      if (insertError.message.includes("relation") || insertError.message.includes("does not exist")) {
        return {
          success: false,
          error: "Transcription queue table not found. Please run the migration_add_transcription_queue.sql file in your Supabase SQL Editor first.",
          details: insertError.message,
          migrationFile: "supabase/migration_add_transcription_queue.sql",
        };
      }
      
      if (insertError.message.includes("violates unique constraint") || insertError.message.includes("duplicate")) {
        // Already in queue, fetch it
        const { data: existingItem } = await supabase
          .from("transcription_queue")
          .select("*")
          .eq("sermon_id", sermonId)
          .single();
        
        if (existingItem) {
          return {
            success: true,
            message: "Sermon already in queue",
            queueItem: existingItem,
          };
        }
      }
      
      return {
        success: false,
        error: "Failed to add to queue",
        details: insertError.message,
      };
    }
    
    console.log(`[Queue] Successfully added to queue:`, queueItem);

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

    return {
      success: true,
      message: "Added to transcription queue",
      queueItem: queueItem,
    };
  } catch (error) {
    console.error("[Queue] Unexpected error:", error);
    console.error("[Queue] Error stack:", error instanceof Error ? error.stack : "No stack trace");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      details: error instanceof Error ? error.stack : String(error),
    };
  }
}
