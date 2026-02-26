/**
 * API Route: Generate a synthesized sermon narrative
 * GPT reads the transcript and produces a story-like article with direct quotes.
 * Persists to unified_summary_json with model "narrative-gpt-4o-mini".
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateSermonNarrative } from "@/lib/generateSermonNarrative";

export const runtime = "nodejs";

function getFullTranscript(sermon: {
  transcript?: string | null;
  progress_json?: {
    completedChunks?: Record<number, string>;
  } | null;
}): string | null {
  if (sermon.transcript && sermon.transcript.trim().length > 0) {
    return sermon.transcript.trim();
  }
  const chunks = sermon.progress_json?.completedChunks;
  if (chunks && Object.keys(chunks).length > 0) {
    const indices = Object.keys(chunks)
      .map(Number)
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b);
    return indices.map((i) => chunks[i]).join("\n\n").trim();
  }
  return null;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("response" in auth) {
      return auth.response;
    }

    let adminClient: ReturnType<typeof createSupabaseAdminClient>;
    try {
      adminClient = createSupabaseAdminClient();
    } catch {
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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey?.trim()) {
      return NextResponse.json(
        {
          error:
            "OpenAI API key not configured. Add OPENAI_API_KEY to environment variables.",
        },
        { status: 500 }
      );
    }

    const { data: sermon, error: sermonError } = await adminClient
      .from("sermons")
      .select("id, transcript, progress_json, speaker, title, series, date")
      .eq("id", sermonId)
      .maybeSingle();

    if (sermonError) {
      return NextResponse.json(
        { error: "Failed to fetch sermon", details: sermonError.message },
        { status: 500 }
      );
    }

    if (!sermon) {
      return NextResponse.json(
        { error: `Sermon with ID "${sermonId}" not found.` },
        { status: 404 }
      );
    }

    const transcript = getFullTranscript(sermon);
    if (!transcript || transcript.length < 200) {
      return NextResponse.json(
        {
          error:
            "No transcript available or transcript too short. Generate a transcript first.",
        },
        { status: 400 }
      );
    }

    const sections = await generateSermonNarrative(transcript, apiKey, {
      speaker: sermon.speaker ?? undefined,
      title: sermon.title ?? undefined,
      series: sermon.series ?? undefined,
      date: sermon.date ?? undefined,
    });

    const { error: updateError } = await adminClient
      .from("sermons")
      .update({
        unified_summary_json: sections as unknown as Record<string, unknown>[],
        unified_summary_generated_at: new Date().toISOString(),
        unified_summary_model: "narrative-gpt-4o-mini",
      })
      .eq("id", sermonId);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to save narrative", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sections,
      generated: sections.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
