/**
 * API Route: Process Next Item in Queue
 * Gets the next item from the queue and marks it as processing.
 * Also used by cron (which calls processor); processor calls getNextQueueItemAndMarkProcessing() directly to avoid 401 on self-request.
 */

import { NextRequest, NextResponse } from "next/server";
import { getNextQueueItemAndMarkProcessing } from "@/lib/queue";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const result = await getNextQueueItemAndMarkProcessing();
    if (!result.success) {
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: 500 }
      );
    }
    return NextResponse.json({
      success: true,
      processing: result.processing ?? false,
      alreadyProcessing: result.alreadyProcessing ?? false,
      queueItem: result.queueItem ?? null,
      sermon: result.sermon ?? null,
    });
  } catch (error) {
    console.error("Error processing queue:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
