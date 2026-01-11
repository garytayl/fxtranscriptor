/**
 * API Route: Get Single Sermon by ID
 * Returns a single sermon from the database by ID
 * Compatible with Next.js 15+ async params
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
        { error: "Supabase not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY" },
        { status: 500 }
      );
    }

    // Next.js 15+ requires awaiting params Promise
    const params = await context.params;
    const id = params?.id;

    if (!id || typeof id !== "string") {
      console.error("[Sermon API] Missing or invalid ID:", { id, params, url: request.url });
      return NextResponse.json(
        { error: "Missing or invalid sermon ID", details: `ID received: ${id}, URL: ${request.url}` },
        { status: 400 }
      );
    }

    const { data: sermon, error } = await supabase
      .from("sermons")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching sermon:", error);
      if (error.message.includes("relation") || error.message.includes("does not exist")) {
        return NextResponse.json(
          { 
            error: "Database tables not found. Please run the schema.sql file in your Supabase SQL Editor first.",
            details: error.message
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { 
          error: "Failed to fetch sermon",
          details: error.message
        },
        { status: 500 }
      );
    }

    if (!sermon) {
      return NextResponse.json(
        { error: `Sermon with ID "${id}" not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({ sermon });
  } catch (error) {
    console.error("Error fetching sermon:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorString = String(error);
    
    if (errorString.includes("522") || 
        errorString.includes("Connection timed out") || 
        errorMessage.includes("522") ||
        errorMessage.includes("timed out") ||
        errorString.includes("mfzrunlgkpbtiwuzmivq.supabase.co")) {
      return NextResponse.json(
        {
          error: "Supabase database connection timed out. This usually means:\n\n" +
                 "1. Your Supabase project is paused (free tier pauses after inactivity)\n" +
                 "2. Go to https://supabase.com/dashboard and open your project to wake it up\n" +
                 "3. Wait 30 seconds and try again"
        },
        { status: 503 } // Service Unavailable
      );
    }
    
    return NextResponse.json(
      {
        error: errorMessage
      },
      { status: 500 }
    );
  }
}
