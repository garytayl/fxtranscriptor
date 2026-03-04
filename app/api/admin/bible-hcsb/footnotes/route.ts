import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const TRANSLATION_SLUG = "HCSB";

/** Admin: get HCSB footnotes for a chapter (for display in reader). */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const bookSlug = searchParams.get("book");
  const chapterParam = searchParams.get("chapter");

  if (!bookSlug) {
    return NextResponse.json({ error: "book is required" }, { status: 400 });
  }

  const slug = bookSlug.toLowerCase().trim();
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("bible_footnotes")
    .select("id, chapter_number, verse_number, marker, text, kind, target_book_slug, target_chapter, target_verse")
    .eq("translation_slug", TRANSLATION_SLUG)
    .eq("book_slug", slug)
    .order("chapter_number", { ascending: true })
    .order("verse_number", { ascending: true })
    .order("marker", { ascending: true });

  if (chapterParam != null && chapterParam !== "") {
    const chapterNumber = parseInt(chapterParam, 10);
    if (!Number.isFinite(chapterNumber) || chapterNumber < 1) {
      return NextResponse.json({ error: "chapter must be a positive integer" }, { status: 400 });
    }
    query = query.eq("chapter_number", chapterNumber);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const footnotes = (data ?? []).map((row) => ({
    id: row.id as string,
    chapterNumber: row.chapter_number as number,
    verseNumber: row.verse_number as number,
    marker: row.marker as string,
    text: row.text as string,
    kind: row.kind as string | null,
    targetBookSlug: row.target_book_slug as string | null,
    targetChapter: row.target_chapter as number | null,
    targetVerse: row.target_verse as number | null,
  }));

  return NextResponse.json({ bookSlug: slug, footnotes });
}

/** Admin: upsert HCSB footnotes for a book (one or more chapters). */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  let body: {
    bookSlug?: string;
    footnotes?: Array<{
      chapterNumber: number;
      verseNumber: number;
      marker: string;
      text: string;
      kind?: string | null;
      targetBookSlug?: string | null;
      targetChapter?: number | null;
      targetVerse?: number | null;
    }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const bookSlug = typeof body.bookSlug === "string" ? body.bookSlug.trim().toLowerCase() : "";
  const footnotes = Array.isArray(body.footnotes)
    ? body.footnotes
        .map((f) => ({
          chapterNumber:
            typeof f.chapterNumber === "number" ? f.chapterNumber : parseInt(String(f?.chapterNumber), 10),
          verseNumber:
            typeof f.verseNumber === "number" ? f.verseNumber : parseInt(String(f?.verseNumber), 10),
          marker: typeof f.marker === "string" ? f.marker.trim() : "",
          text: typeof f.text === "string" ? f.text.trim() : "",
          kind:
            f.kind === null || f.kind === undefined
              ? null
              : ["cross_reference", "alternate_reading", "explanatory", "textual"].includes(String(f.kind))
                ? String(f.kind)
                : null,
          targetBookSlug:
            f.targetBookSlug != null && typeof f.targetBookSlug === "string"
              ? f.targetBookSlug.trim().toLowerCase() || null
              : null,
          targetChapter:
            f.targetChapter != null && Number.isFinite(Number(f.targetChapter))
              ? Number(f.targetChapter)
              : null,
          targetVerse:
            f.targetVerse != null && Number.isFinite(Number(f.targetVerse)) ? Number(f.targetVerse) : null,
        }))
        .filter(
          (f) =>
            Number.isFinite(f.chapterNumber) &&
            f.chapterNumber >= 1 &&
            Number.isFinite(f.verseNumber) &&
            f.verseNumber >= 1 &&
            f.marker.length > 0 &&
            f.text.length > 0
        )
    : [];

  if (!bookSlug) {
    return NextResponse.json({ error: "bookSlug is required" }, { status: 400 });
  }

  if (footnotes.length === 0) {
    return NextResponse.json({ success: true, bookSlug, count: 0 });
  }

  const supabase = createSupabaseAdminClient();

  const rows = footnotes.map((f) => ({
    translation_slug: TRANSLATION_SLUG,
    book_slug: bookSlug,
    chapter_number: f.chapterNumber,
    verse_number: f.verseNumber,
    marker: f.marker,
    text: f.text,
    kind: f.kind ?? null,
    target_book_slug: f.targetBookSlug ?? null,
    target_chapter: f.targetChapter ?? null,
    target_verse: f.targetVerse ?? null,
  }));

  const { error: upsertError } = await supabase.from("bible_footnotes").upsert(rows, {
    onConflict: "translation_slug,book_slug,chapter_number,verse_number,marker",
    ignoreDuplicates: false,
  });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    bookSlug,
    count: footnotes.length,
  });
}
