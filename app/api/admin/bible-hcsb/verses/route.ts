import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const TRANSLATION_SLUG = "HCSB";

/** Admin: get HCSB verses for a chapter (for revise step). */
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
    .from("bible_verses")
    .select("verse_number, text")
    .eq("translation_slug", TRANSLATION_SLUG)
    .eq("book_slug", bookSlug.toLowerCase().trim())
    .eq("chapter_number", chapterNumber)
    .order("verse_number", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const verses = (data ?? []).map((row) => ({
    number: row.verse_number as number,
    text: row.text as string,
  }));

  return NextResponse.json({ bookSlug, chapterNumber, verses });
}

/** Admin: upsert HCSB verses for a chapter (save after revise). */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  let body: { bookSlug?: string; chapterNumber?: number; verses?: Array<{ number: number; text: string }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const bookSlug = typeof body.bookSlug === "string" ? body.bookSlug.trim().toLowerCase() : "";
  const chapterNumber =
    typeof body.chapterNumber === "number" && Number.isFinite(body.chapterNumber) ? body.chapterNumber : NaN;
  const verses = Array.isArray(body.verses)
    ? body.verses
        .map((v) => ({
          number: typeof v.number === "number" ? v.number : parseInt(String(v?.number), 10),
          text: typeof v.text === "string" ? v.text.trim() : "",
        }))
        .filter((v) => Number.isFinite(v.number) && v.number >= 1)
    : [];

  if (!bookSlug || !Number.isFinite(chapterNumber) || chapterNumber < 1) {
    return NextResponse.json({ error: "bookSlug and chapterNumber (positive integer) are required" }, { status: 400 });
  }

  if (verses.length === 0) {
    return NextResponse.json({ error: "At least one verse (number) is required" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const rows = verses.map((v) => ({
    translation_slug: TRANSLATION_SLUG,
    book_slug: bookSlug,
    chapter_number: chapterNumber,
    verse_number: v.number,
    text: v.text,
  }));

  const { error: upsertError } = await supabase.from("bible_verses").upsert(rows, {
    onConflict: "translation_slug,book_slug,chapter_number,verse_number",
    ignoreDuplicates: false,
  });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    bookSlug,
    chapterNumber,
    count: verses.length,
  });
}

/** Admin: delete HCSB verses for a chapter or entire book. */
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const bookSlug = searchParams.get("book")?.trim().toLowerCase();
  const chapterParam = searchParams.get("chapter");

  if (!bookSlug) {
    return NextResponse.json({ error: "book is required" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  let versesQuery = supabase
    .from("bible_verses")
    .delete()
    .eq("translation_slug", TRANSLATION_SLUG)
    .eq("book_slug", bookSlug);

  let footnotesQuery = supabase
    .from("bible_footnotes")
    .delete()
    .eq("translation_slug", TRANSLATION_SLUG)
    .eq("book_slug", bookSlug);

  if (chapterParam != null && chapterParam !== "") {
    const chapterNumber = parseInt(chapterParam, 10);
    if (!Number.isFinite(chapterNumber) || chapterNumber < 1) {
      return NextResponse.json({ error: "chapter must be a positive integer" }, { status: 400 });
    }
    versesQuery = versesQuery.eq("chapter_number", chapterNumber);
    footnotesQuery = footnotesQuery.eq("chapter_number", chapterNumber);
  }

  const [versesResult, footnotesResult] = await Promise.all([
    versesQuery,
    footnotesQuery,
  ]);

  if (versesResult.error) {
    return NextResponse.json({ error: versesResult.error.message }, { status: 500 });
  }
  if (footnotesResult.error) {
    return NextResponse.json({ error: footnotesResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    bookSlug,
    ...(chapterParam != null && chapterParam !== ""
      ? { clearedChapter: parseInt(chapterParam, 10) }
      : { clearedBook: true }),
  });
}
