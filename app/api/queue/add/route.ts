/**
 * API Route: Add Sermon to Transcription Queue
 * Adds a sermon to the global transcription queue
 */

import { NextRequest, NextResponse } from "next/server";
import { addSermonToQueue } from "@/lib/queue";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sermonId } = body;

    if (!sermonId || typeof sermonId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid sermonId" },
        { status: 400 }
      );
    }

    // Use shared queue function
    const result = await addSermonToQueue(sermonId);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || "Failed to add to queue",
          details: result.details,
          migrationFile: result.migrationFile,
        },
        { status: result.error?.includes("not found") ? 404 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message || "Added to transcription queue",
      queueItem: result.queueItem,
    });
  } catch (error) {
    console.error("[Queue Add] Unexpected error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}
