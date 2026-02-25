/**
 * GET /api/auth/session
 * Returns current user, profile, and isAdmin. No auth required; used by client for role-aware UI.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    return NextResponse.json(session);
  } catch (error) {
    console.error("Session error:", error);
    return NextResponse.json(
      { user: null, profile: null, isAdmin: false },
      { status: 200 }
    );
  }
}
