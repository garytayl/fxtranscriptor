/**
 * API Route: Manage Transcription State
 * Handles canceling transcription and deleting chunks
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
    const { sermonId, action } = body;

    if (!sermonId || typeof sermonId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid sermonId" },
        { status: 400 }
      );
    }

    if (!action || typeof action !== "string" || !["cancel", "delete-chunks"].includes(action)) {
      return NextResponse.json(
        { error: "Missing or invalid action. Must be 'cancel' or 'delete-chunks'" },
        { status: 400 }
      );
    }

    // Get current sermon state
    const { data: sermon, error: fetchError } = await supabase
      .from("sermons")
      .select("*")
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
        { error: `Sermon with ID "${sermonId}" not found.` },
        { status: 404 }
      );
    }

    let updateData: any = {};

    if (action === "cancel") {
      // Cancel transcription: set status to pending, but keep completed chunks if any exist
      const currentProgress = sermon.progress_json || {};
      const hasChunks = currentProgress.completedChunks && Object.keys(currentProgress.completedChunks).length > 0;
      
      if (hasChunks) {
        // Preserve chunks
        updateData = {
          status: "pending",
          error_message: null,
          progress_json: {
            ...currentProgress,
            step: "cancelled",
            message: "Transcription cancelled by user. Completed chunks preserved.",
          },
        };
        console.log(`[ManageTranscription] Cancelling transcription for sermon ${sermonId}, preserving ${Object.keys(currentProgress.completedChunks).length} chunks`);
      } else {
        // No chunks to preserve, clear progress
        updateData = {
          status: "pending",
          error_message: null,
          progress_json: null,
        };
        console.log(`[ManageTranscription] Cancelling transcription for sermon ${sermonId}, no chunks to preserve`);
      }
    } else if (action === "delete-chunks") {
      // Delete chunks: clear completedChunks and failedChunks from progress_json
      const currentProgress = sermon.progress_json || {};
      const newProgress = { ...currentProgress };
      delete newProgress.completedChunks;
      delete newProgress.failedChunks;
      
      // If no other progress data, set to null
      if (Object.keys(newProgress).length === 0 || (Object.keys(newProgress).length === 1 && newProgress.step === "cancelled")) {
        updateData = {
          progress_json: null,
        };
      } else {
        updateData = {
          progress_json: newProgress,
        };
      }
      console.log(`[ManageTranscription] Deleting chunks for sermon ${sermonId}`);
    }

    // Update sermon
    const { data: updatedSermon, error: updateError } = await supabase
      .from("sermons")
      .update(updateData)
      .eq("id", sermonId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating sermon:", updateError);
      return NextResponse.json(
        { error: "Failed to update sermon", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sermon: updatedSermon,
      action,
    });
  } catch (error) {
    console.error("Error managing transcription:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
