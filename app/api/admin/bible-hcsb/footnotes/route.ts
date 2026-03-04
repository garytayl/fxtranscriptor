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

  if (!bookSlug || !chapterParam) {
    return NextResponse.json({ error: "book and chapter are required" }, { status: 400 });
  }

  const chapterNumber = parseInt(chapterParam, 10);
  if (!Number.isFinite(chapterNumber) || chapterNumber < 1) {
    return NextResponse.json({ error: "chapter must be a positive integer" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("bible_footnotes")
    .select("verse_number, marker, text")
    .eq("translation_slug", TRANSLATION_SLUG)
    .eq("book_slug", bookSlug.toLowerCase().trim())
    .eq("chapter_number", chapterNumber)
    .order("verse_number", { ascending: true })
    .order("marker", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const footnotes = (data ?? []).map((row) => ({
    verseNumber: row.verse_number as number,
    marker: row.marker as string,
    text: row.text as string,
  }));

  return NextResponse.json({ bookSlug, chapterNumber, footnotes });
}

/** Admin: upsert HCSB footnotes for a book (one or more chapters). */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  let body: {
    bookSlug?: string;
    footnotes?: Array<{ chapterNumber: number; verseNumber: number; marker: string; text: string }>;
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
