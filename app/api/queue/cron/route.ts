/**
 * API Route: Queue Processor Cron
 * This endpoint can be called by Vercel Cron Jobs to periodically process the queue
 * Set up a cron job in vercel.json to call this endpoint every 10-30 seconds
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret if set (optional security)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get the app URL
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

    // Call the processor endpoint
    const processorResponse = await fetch(`${appUrl}/api/queue/processor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const processorData = await processorResponse.json().catch(() => ({
      success: false,
      error: "Failed to parse response",
    }));

    return NextResponse.json({
      success: processorData.success || false,
      message: processorData.message || processorData.error || "Queue processor called",
      processed: processorData.processed || false,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in queue cron:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
