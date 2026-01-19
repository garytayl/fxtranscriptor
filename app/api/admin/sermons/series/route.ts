import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) {
    return auth.response;
  }

  const body = await request.json().catch(() => ({}));
  const sermonIds = Array.isArray(body.sermonIds) ? body.sermonIds : [];

  if (sermonIds.length === 0) {
    return NextResponse.json({ error: "No sermon IDs provided." }, { status: 400 });
  }

  const seriesOverride =
    typeof body.seriesOverride === "string" && body.seriesOverride.trim()
      ? body.seriesOverride.trim()
      : null;

  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient
    .from("sermons")
    .update({ series_override: seriesOverride })
    .in("id", sermonIds);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    updated: sermonIds.length,
    seriesOverride,
  });
}

