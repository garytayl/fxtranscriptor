/**
 * API Route: Clear chunk summaries for a sermon
 * Deletes all summaries and verses for a sermon
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const params = await context.params;
    const sermonId = params?.id;

    if (!sermonId || typeof sermonId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid sermon ID" },
        { status: 400 }
      );
    }

    // Fetch existing summaries to get IDs for verse deletion
    const { data: existingSummaries, error: fetchError } = await supabase
      .from("sermon_chunk_summaries")
      .select("id")
      .eq("sermon_id", sermonId);

    if (fetchError) {
      console.error("Error fetching summaries:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch summaries", details: fetchError.message },
        { status: 500 }
      );
    }

    // Delete verses first (foreign key constraint)
    if (existingSummaries && existingSummaries.length > 0) {
      const summaryIds = existingSummaries.map((s) => s.id);
      
      const { error: versesError } = await supabase
        .from("sermon_chunk_verses")
        .delete()
        .in("summary_id", summaryIds);

      if (versesError) {
        console.error("Error deleting verses:", versesError);
        return NextResponse.json(
          { error: "Failed to delete verses", details: versesError.message },
          { status: 500 }
        );
      }
    }

    // Delete summaries
    const { error: summariesError } = await supabase
      .from("sermon_chunk_summaries")
      .delete()
      .eq("sermon_id", sermonId);

    if (summariesError) {
      console.error("Error deleting summaries:", summariesError);
      return NextResponse.json(
        { error: "Failed to delete summaries", details: summariesError.message },
        { status: 500 }
      );
    }

    // Clear unified summary cache on sermon (since source summaries are gone)
    const { error: clearUnifiedError } = await supabase
      .from("sermons")
      .update({
        unified_summary_json: null,
        unified_summary_generated_at: null,
        unified_summary_model: null,
      })
      .eq("id", sermonId);

    if (clearUnifiedError) {
      console.error("Error clearing unified summary:", clearUnifiedError);
      // Do not fail the request; the main operation (deleting chunk summaries) succeeded.
    }

    return NextResponse.json({
      success: true,
      deleted: existingSummaries?.length || 0,
    });
  } catch (error) {
    console.error("Error clearing summaries:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
