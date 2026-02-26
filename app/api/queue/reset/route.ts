/**
 * API Route: Reset Transcription Queue
 * Removes completed/failed/cancelled rows and renumbers queued items to 1, 2, 3...
 * Admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("response" in auth) {
      return auth.response;
    }

    let supabaseClient: ReturnType<typeof createSupabaseAdminClient>;
    try {
      supabaseClient = createSupabaseAdminClient();
    } catch (error) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    // 1. Delete completed, failed, cancelled so table stays clean and positions make sense
    const { error: deleteError } = await supabaseClient
      .from("transcription_queue")
      .delete()
      .in("status", ["completed", "failed", "cancelled"]);

    if (deleteError) {
      console.error("Error cleaning queue:", deleteError);
      return NextResponse.json(
        { error: "Failed to clean queue", details: deleteError.message },
        { status: 500 }
      );
    }

    // 2. Get all queued items ordered by position
    const { data: queuedItems, error: fetchError } = await supabaseClient
      .from("transcription_queue")
      .select("id, position")
      .eq("status", "queued")
      .order("position", { ascending: true });

    if (fetchError) {
      console.error("Error fetching queued items:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch queue", details: fetchError.message },
        { status: 500 }
      );
    }

    // 3. Renumber to 1, 2, 3, ...
    if (queuedItems && queuedItems.length > 0) {
      for (let i = 0; i < queuedItems.length; i++) {
        const newPosition = i + 1;
        if (queuedItems[i].position === newPosition) continue;
        const { error: updateError } = await supabaseClient
          .from("transcription_queue")
          .update({ position: newPosition })
          .eq("id", queuedItems[i].id);
        if (updateError) {
          console.error("Error renumbering queue item:", updateError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Queue reset: cleared old entries and renumbered queued items.",
    });
  } catch (error) {
    console.error("Error resetting queue:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
