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

    // Display position: 1-based among active items (queued + processing) so user sees "position 1" not "position 4"
    const { data: activeItems } = await supabase
      .from("transcription_queue")
      .select("id, position")
      .in("status", ["queued", "processing"])
      .order("position", { ascending: true });
    const activeIndex = activeItems?.findIndex((r) => r.id === queueItem.id) ?? -1;
    const displayPosition = activeIndex >= 0 ? activeIndex + 1 : position;

    // Update sermon status (use display position in message so it matches queue card)
    await supabase
      .from("sermons")
      .update({
        status: "generating",
        progress_json: {
          step: "queued",
          message: `Queued for transcription (position ${displayPosition} in queue)...`,
          position: displayPosition,
        },
      })
      .eq("id", sermonId);

    return {
      success: true,
      message: "Added to transcription queue",
      queueItem: { ...queueItem, displayPosition },
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

const STALE_PROCESSING_MS = 15 * 60 * 1000; // 15 minutes

export interface ProcessQueueResult {
  success: boolean;
  processing?: boolean;
  alreadyProcessing?: boolean;
  queueItem?: any;
  sermon?: any;
  error?: string;
  details?: string;
}

/**
 * Get the next queue item (or current processing item), mark as processing if queued.
 * Used by both /api/queue/process (HTTP) and /api/queue/processor (direct call) to avoid
 * server-to-self requests that can hit 401 under Vercel Deployment Protection.
 */
export async function getNextQueueItemAndMarkProcessing(): Promise<ProcessQueueResult> {
  try {
    const supabase = createSupabaseAdminClient();

    const { data: processingItem } = await supabase
      .from("transcription_queue")
      .select("*")
      .eq("status", "processing")
      .maybeSingle();

    if (processingItem) {
      const startedAt = processingItem.started_at ? new Date(processingItem.started_at).getTime() : 0;
      const isStale = Date.now() - startedAt > STALE_PROCESSING_MS;

      if (isStale) {
        await supabase
          .from("transcription_queue")
          .update({
            status: "failed",
            error_message: "Processing timed out (worker may have stopped or failed to report completion)",
            completed_at: new Date().toISOString(),
          })
          .eq("id", processingItem.id);
        await supabase
          .from("sermons")
          .update({ status: "failed", error_message: "Transcription timed out" })
          .eq("id", processingItem.sermon_id);
      } else {
        const { data: sermon } = await supabase
          .from("sermons")
          .select("*")
          .eq("id", processingItem.sermon_id)
          .single();
        return {
          success: true,
          processing: true,
          alreadyProcessing: true,
          queueItem: processingItem,
          sermon: sermon ?? undefined,
        };
      }
    }

    const { data: nextItem, error: fetchError } = await supabase
      .from("transcription_queue")
      .select("*")
      .eq("status", "queued")
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      return { success: false, error: "Failed to fetch queue", details: fetchError.message };
    }
    if (!nextItem) {
      return { success: true, processing: false, queueItem: null, sermon: null };
    }

    const { data: updatedItem, error: updateError } = await supabase
      .from("transcription_queue")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", nextItem.id)
      .select()
      .single();

    if (updateError) {
      return { success: false, error: "Failed to update queue item", details: updateError.message };
    }

    const { data: sermon, error: sermonError } = await supabase
      .from("sermons")
      .select("*")
      .eq("id", nextItem.sermon_id)
      .single();

    if (sermonError) {
      return { success: false, error: "Failed to fetch sermon", details: sermonError.message };
    }

    await supabase
      .from("sermons")
      .update({
        status: "generating",
        progress_json: {
          step: "processing",
          message: "Transcription in progress...",
          position: 1,
        },
      })
      .eq("id", nextItem.sermon_id);

    return {
      success: true,
      processing: true,
      queueItem: updatedItem,
      sermon: sermon ?? undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get the next queued item, mark it processing, and call the worker.
 * Used by the processor route and by the complete route (to start the next job when one finishes).
 */
export async function triggerWorkerForNextItem(): Promise<{
  started: boolean;
  error?: string;
  message?: string;
}> {
  let queueItem: any = null;
  let sermon: any = null;
  try {
    const supabase = createSupabaseAdminClient();
    const processData = await getNextQueueItemAndMarkProcessing();
    if (!processData.success) {
      return { started: false, error: processData.error };
    }
    if (!processData.processing || !processData.sermon || processData.alreadyProcessing) {
      return { started: false, message: processData.alreadyProcessing ? "Item already being processed" : "No items in queue" };
    }
    queueItem = processData.queueItem;
    sermon = processData.sermon;
    const workerUrl = process.env.AUDIO_WORKER_URL?.trim();
    if (!workerUrl) {
      await supabase
        .from("transcription_queue")
        .update({
          status: "failed",
          error_message: "Worker service not configured (AUDIO_WORKER_URL missing)",
          completed_at: new Date().toISOString(),
        })
        .eq("id", queueItem.id);
      await supabase
        .from("sermons")
        .update({ status: "failed", error_message: "Worker service not configured" })
        .eq("id", sermon.id);
      return { started: false, error: "Worker service not configured" };
    }
    const audioSource = sermon.audio_url || sermon.youtube_url;
    if (!audioSource) {
      await supabase
        .from("transcription_queue")
        .update({
          status: "failed",
          error_message: "No audio_url or youtube_url available",
          completed_at: new Date().toISOString(),
        })
        .eq("id", queueItem.id);
      await supabase
        .from("sermons")
        .update({ status: "failed", error_message: "No audio_url or youtube_url available" })
        .eq("id", sermon.id);
      return { started: false, error: "No audio source available" };
    }
    const { data: currentQueueItem } = await supabase
      .from("transcription_queue")
      .select("status")
      .eq("id", queueItem.id)
      .single();
    if (currentQueueItem?.status === "cancelled") {
      return { started: false, message: "Queue item was cancelled" };
    }
    const cleanWorkerUrl = workerUrl.replace(/\/$/, "");
    const workerResponse = await fetch(`${cleanWorkerUrl}/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sermonId: sermon.id, audioUrl: audioSource }),
      signal: AbortSignal.timeout(60000),
    });
    if (!workerResponse.ok) {
      const errorText = await workerResponse.text().catch(() => "Unknown error");
      throw new Error(`Worker error: ${workerResponse.status} ${errorText}`);
    }
    console.log(`[Queue] Worker accepted transcription: ${sermon.id} - ${sermon.title}`);
    return { started: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    let errorMessage = err.message;
    if (errorMessage.includes("aborted") || errorMessage.includes("timeout")) {
      errorMessage = "Worker took too long to respond (timeout). Try Trigger processor again.";
    }
    if (queueItem && sermon) {
      try {
        const supabase = createSupabaseAdminClient();
        await supabase
          .from("transcription_queue")
          .update({
            status: "failed",
            error_message: errorMessage,
            completed_at: new Date().toISOString(),
          })
          .eq("id", queueItem.id);
        await supabase
          .from("sermons")
          .update({ status: "failed", error_message: errorMessage })
          .eq("id", sermon.id);
      } catch {
        // ignore
      }
    }
    return { started: false, error: errorMessage };
  }
}
