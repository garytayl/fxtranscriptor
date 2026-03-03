import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Public: list published devotion topics for topical studies (weekly). */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("devotion_topics")
    .select("id, title, slug, description, bible_references, sort_order, created_at")
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ topics: data ?? [] });
}
