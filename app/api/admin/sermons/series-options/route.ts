import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) {
    return auth.response;
  }

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("sermons")
    .select("series, series_override");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const seriesSet = new Set<string>();
  (data || []).forEach((row) => {
    const s = row.series?.trim();
    if (s) seriesSet.add(s);
    const o = row.series_override?.trim();
    if (o) seriesSet.add(o);
  });

  const seriesOptions = Array.from(seriesSet).sort((a, b) => a.localeCompare(b));
  return NextResponse.json({ seriesOptions });
}

