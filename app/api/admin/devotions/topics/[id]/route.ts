import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Admin: update a devotion topic. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Topic id required." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (title) updates.title = title;
  }
  if (typeof body.slug === "string") {
    updates.slug = (body.slug.trim() || slugify((body.title as string) || "") || "topic").trim();
  }
  if (body.description !== undefined) {
    updates.description = typeof body.description === "string" ? body.description.trim() || null : null;
  }
  if (body.body !== undefined) {
    updates.body = typeof body.body === "string" ? body.body.trim() || null : null;
  }
  if (Array.isArray(body.bible_references)) {
    updates.bible_references = body.bible_references.map((r) => String(r).trim()).filter(Boolean);
  }
  if (typeof body.sort_order === "number" && Number.isFinite(body.sort_order)) {
    updates.sort_order = body.sort_order;
  }
  if (typeof body.published === "boolean") {
    updates.published = body.published;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("devotion_topics")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/** Admin: delete a devotion topic. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Topic id required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("devotion_topics").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
