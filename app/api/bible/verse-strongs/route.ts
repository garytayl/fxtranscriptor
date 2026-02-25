import { NextRequest, NextResponse } from "next/server"
import { getStrongsForChapter } from "@/lib/bible/verse-strongs"

export const runtime = "nodejs"

/**
 * GET /api/bible/verse-strongs?book=john&chapter=3
 * Returns Strong's codes per verse for the chapter (KJV word order).
 * Response: { "1": ["G1722","G746",...], "2": [...], ... }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const book = searchParams.get("book")
  const chapterParam = searchParams.get("chapter")
  if (!book || !chapterParam) {
    return NextResponse.json(
      { error: "Query parameters 'book' and 'chapter' are required." },
      { status: 400 }
    )
  }
  const chapter = parseInt(chapterParam, 10)
  if (!Number.isFinite(chapter) || chapter < 1) {
    return NextResponse.json({ error: "Invalid chapter." }, { status: 400 })
  }
  try {
    const strongsByVerse = await getStrongsForChapter(book, chapter)
    const serialized: Record<string, string[]> = {}
    for (const [verseNum, codes] of Object.entries(strongsByVerse)) {
      serialized[String(verseNum)] = codes
    }
    return NextResponse.json(serialized)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load verse Strong's."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
