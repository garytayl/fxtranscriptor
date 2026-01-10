import { NextRequest, NextResponse } from "next/server";
import { fetchTranscript } from "@/lib/fetchTranscript";

export const runtime = "nodejs"; // Use Node.js runtime for flexible fetching

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'url' parameter" },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Allow any valid URL - the extraction will handle various podcast platforms
    // This is intentionally flexible to support Apple Podcasts, RSS feeds, etc.

    // Fetch transcript using tiered strategy
    const result = await fetchTranscript(url);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || "Failed to extract transcript",
          title: result.title,
          source: result.source,
          audioUrl: result.audioUrl, // For future Whisper fallback
        },
        { status: 404 }
      );
    }

    // Final validation: ensure transcript has meaningful content
    const cleanedTranscript = result.transcript.trim();
    if (cleanedTranscript.length < 100) {
      return NextResponse.json(
        {
          error: "Transcript found but content is too short or empty. The episode may not have a full transcript available.",
          title: result.title,
          source: result.source,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      title: result.title || "Untitled Episode",
      transcript: cleanedTranscript,
      source: result.source || "unknown",
      videoId: result.videoId,
      audioUrl: result.audioUrl, // For future Whisper fallback
    });
  } catch (error) {
    console.error("API error:", error);
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
