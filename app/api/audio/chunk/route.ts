/**
 * API Route: Chunk Audio for Large Files
 * Calls worker service to chunk audio files >20MB into 10-minute segments
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const WORKER_URL = process.env.AUDIO_WORKER_URL || "";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { audioUrl } = body;

    if (!audioUrl || typeof audioUrl !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid audioUrl parameter" },
        { status: 400 }
      );
    }

    if (!WORKER_URL || WORKER_URL.trim().length === 0) {
      return NextResponse.json(
        { 
          error: "Audio worker service not configured. Set AUDIO_WORKER_URL environment variable.",
          chunks: [],
        },
        { status: 500 }
      );
    }

    console.log(`[Chunk] Requesting chunking for audio: ${audioUrl.substring(0, 100)}...`);
    console.log(`[Chunk] Worker URL: ${WORKER_URL}`);

    // Call worker service
    const workerResponse = await fetch(`${WORKER_URL}/chunk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ audioUrl }),
    });

    if (!workerResponse.ok) {
      const errorText = await workerResponse.text().catch(() => "Unknown error");
      console.error(`[Chunk] Worker service error: ${workerResponse.status} ${errorText}`);
      return NextResponse.json(
        { 
          error: `Worker service error: ${workerResponse.status} ${errorText}`,
          chunks: [],
        },
        { status: workerResponse.status }
      );
    }

    const workerData = await workerResponse.json();

    if (!workerData.success || !workerData.chunks || !Array.isArray(workerData.chunks)) {
      console.error(`[Chunk] Invalid worker response:`, workerData);
      return NextResponse.json(
        { 
          error: "Invalid response from worker service",
          chunks: [],
        },
        { status: 500 }
      );
    }

    console.log(`[Chunk] ✅ Successfully chunked audio into ${workerData.chunks.length} chunks`);
    
    return NextResponse.json({
      success: true,
      chunks: workerData.chunks,
      totalDuration: workerData.totalDuration,
      chunkCount: workerData.chunkCount,
    });
  } catch (error) {
    console.error("[Chunk] Error chunking audio:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        chunks: [],
      },
      { status: 500 }
    );
  }
}
