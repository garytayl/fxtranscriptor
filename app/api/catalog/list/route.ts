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
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
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
      throw error;
    }

    return NextResponse.json({
      sermons: sermons || [],
      count: sermons?.length || 0,
    });
  } catch (error) {
    console.error("Error fetching catalog:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
