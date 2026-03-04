import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Admin: update a single HCSB footnote by id. */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  let body: {
    text?: string;
    kind?: string | null;
    targetBookSlug?: string | null;
    targetChapter?: number | null;
    targetVerse?: number | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.text === "string") updates.text = body.text.trim();
  if (body.kind !== undefined) {
    updates.kind =
      body.kind === null || body.kind === ""
        ? null
        : ["cross_reference", "alternate_reading", "explanatory", "textual"].includes(String(body.kind))
          ? body.kind
          : undefined;
  }
  if (body.targetBookSlug !== undefined) {
    updates.target_book_slug =
      body.targetBookSlug == null || body.targetBookSlug === ""
        ? null
        : String(body.targetBookSlug).trim().toLowerCase();
  }
  if (body.targetChapter !== undefined) {
    const v = body.targetChapter;
    updates.target_chapter =
      v == null || !Number.isFinite(Number(v)) ? null : Number(v);
  }
  if (body.targetVerse !== undefined) {
    const v = body.targetVerse;
    updates.target_verse =
      v == null || !Number.isFinite(Number(v)) ? null : Number(v);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("bible_footnotes")
    .update(updates)
    .eq("id", id)
    .select("id, chapter_number, verse_number, marker, text, kind, target_book_slug, target_chapter, target_verse")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Footnote not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    footnote: {
      id: data.id,
      chapterNumber: data.chapter_number,
      verseNumber: data.verse_number,
      marker: data.marker,
      text: data.text,
      kind: data.kind,
      targetBookSlug: data.target_book_slug,
      targetChapter: data.target_chapter,
      targetVerse: data.target_verse,
    },
  });
}
