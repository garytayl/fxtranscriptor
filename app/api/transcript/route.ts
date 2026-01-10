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
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      title: result.title || "Untitled Episode",
      transcript: result.transcript,
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
