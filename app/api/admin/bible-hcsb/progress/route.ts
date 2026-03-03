import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { BIBLE_BOOKS_WITH_CHAPTER_COUNTS } from "@/lib/bible/constants";
import { slugifyBookName } from "@/lib/bible/reference";

const TRANSLATION_SLUG = "HCSB";

/** Admin: HCSB import progress — which books/chapters have verses in DB. */
export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const supabase = createSupabaseAdminClient();
  const { data: rows, error } = await supabase
    .from("bible_verses")
    .select("book_slug, chapter_number")
    .eq("translation_slug", TRANSLATION_SLUG);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const completedSet = new Map<string, Set<number>>();
  for (const row of rows ?? []) {
    const slug = row.book_slug as string;
    const ch = row.chapter_number as number;
    if (!completedSet.has(slug)) completedSet.set(slug, new Set());
    completedSet.get(slug)!.add(ch);
  }

  const books = BIBLE_BOOKS_WITH_CHAPTER_COUNTS.map((book) => {
    const slug = slugifyBookName(book.name);
    const completedChapters = Array.from(completedSet.get(slug) ?? []).sort((a, b) => a - b);
    return {
      id: book.id,
      name: book.name,
      slug,
      chapters: book.chapters,
      completedChapters,
      totalVerses: 0,
    };
  });

  return NextResponse.json({ books, translationSlug: TRANSLATION_SLUG });
}
