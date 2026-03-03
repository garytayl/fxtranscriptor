import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Admin: list all devotion topics (including unpublished). */
export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("devotion_topics")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ topics: data ?? [] });
}

/** Admin: create a devotion topic. */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const slugRaw = typeof body.slug === "string" ? body.slug.trim() : "";
  const slug = slugRaw || slugify(title) || "topic";
  const description = typeof body.description === "string" ? body.description.trim() || null : null;
  const bodyText = typeof body.body === "string" ? body.body.trim() || null : null;
  const bibleRefs = Array.isArray(body.bible_references)
    ? body.bible_references.map((r) => String(r).trim()).filter(Boolean)
    : [];
  const sortOrder = typeof body.sort_order === "number" && Number.isFinite(body.sort_order) ? body.sort_order : 0;
  const published = body.published !== false;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("devotion_topics")
    .insert({
      title,
      slug,
      description,
      body: bodyText,
      bible_references: bibleRefs,
      sort_order: sortOrder,
      published,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
