/**
 * API Route: Get Catalog
 * Returns all sermons from the database
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    const status = searchParams.get("status") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("sermons")
      .select("*")
      .order("date", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: sermons, error } = await query;

    if (error) {
      console.error("Error fetching sermons:", error);
      if (error.message.includes("relation") || error.message.includes("does not exist")) {
        return NextResponse.json(
          { 
            error: "Database tables not found. Please run the schema.sql file in your Supabase SQL Editor first.",
            details: error.message,
            sermons: [],
            count: 0
          },
          { status: 500 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      sermons: sermons || [],
      count: sermons?.length || 0,
    });
  } catch (error) {
    console.error("Error fetching catalog:", error);
    
    // Check for Supabase connection timeout errors
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
                 "3. Wait 30 seconds and try again",
          sermons: [],
          count: 0
        },
        { status: 503 } // Service Unavailable
      );
    }
    
    return NextResponse.json(
      {
        error: errorMessage,
        sermons: [],
        count: 0
      },
      { status: 500 }
    );
  }
}
