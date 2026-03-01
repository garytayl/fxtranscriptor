/**
 * API Route: Queue Processor
 * Processes the next item in the transcription queue.
 * Also called after a job completes (from complete route) to start the next one.
 */

import { NextRequest, NextResponse } from "next/server";
import { triggerWorkerForNextItem } from "@/lib/queue";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const result = await triggerWorkerForNextItem();
    if (result.started) {
      return NextResponse.json({
        success: true,
        message: "Transcription started by worker",
        processed: true,
      });
    }
    return NextResponse.json({
      success: true,
      message: result.message || result.error || "No items in queue",
      processed: false,
      error: result.error,
    });
  } catch (error) {
    console.error("Error in queue processor:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
