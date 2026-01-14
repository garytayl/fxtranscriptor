/**
 * API Route: Get chunk summaries for a sermon
 * Returns all summaries and verses for a sermon
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(
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

    // Fetch all summaries for this sermon
    const { data: summaries, error: summariesError } = await supabase
      .from("sermon_chunk_summaries")
      .select("*")
      .eq("sermon_id", sermonId)
      .order("chunk_index", { ascending: true });

    if (summariesError) {
      console.error("Error fetching summaries:", summariesError);
      return NextResponse.json(
        { error: "Failed to fetch summaries", details: summariesError.message },
        { status: 500 }
      );
    }

    if (!summaries || summaries.length === 0) {
      return NextResponse.json({
        summaries: [],
        verses: {},
      });
    }

    // Fetch all verses for these summaries
    const summaryIds = summaries.map((s) => s.id);
    const { data: verses, error: versesError } = await supabase
      .from("sermon_chunk_verses")
      .select("*")
      .in("summary_id", summaryIds)
      .order("created_at", { ascending: true });

    if (versesError) {
      console.error("Error fetching verses:", versesError);
      return NextResponse.json(
        { error: "Failed to fetch verses", details: versesError.message },
        { status: 500 }
      );
    }

    // Group verses by summary_id
    const versesBySummary: Record<string, typeof verses> = {};
    if (verses) {
      for (const verse of verses) {
        if (!versesBySummary[verse.summary_id]) {
          versesBySummary[verse.summary_id] = [];
        }
        versesBySummary[verse.summary_id].push(verse);
      }
    }

    // Attach verses to summaries
    const summariesWithVerses = summaries.map((summary) => ({
      ...summary,
      verses: versesBySummary[summary.id] || [],
    }));

    return NextResponse.json({
      summaries: summariesWithVerses,
    });
  } catch (error) {
    console.error("Error fetching summaries:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
