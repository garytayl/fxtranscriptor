import { NextRequest, NextResponse } from "next/server"
import { getStrongsForChapter, getStrongsWordsForChapter } from "@/lib/bible/verse-strongs"

export const runtime = "nodejs"

/**
 * GET /api/bible/verse-strongs?book=john&chapter=3&id=JHN
 * Optional `id` is the API.Bible book id (USFM) when `book` slug does not match our map.
 * Returns Strong's codes per verse for the chapter (KJV word order).
 * Response: { "1": ["G1722","G746",...], "2": [...], ... }
 *
 * With `detail=words`, returns KJV surface words with Strong's codes (same as scripture reader):
 * { "verses": { "1": [{ "word": "In", "code": "G1722" }, ...], ... } }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const bookSlug = searchParams.get("book")
  const bookId = searchParams.get("id") ?? ""
  const chapterParam = searchParams.get("chapter")
  const detail = searchParams.get("detail")
  if (!bookSlug || !chapterParam) {
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
    const bookRef = { slug: bookSlug, id: bookId }
    if (detail === "words") {
      const wordsByVerse = await getStrongsWordsForChapter(bookRef, chapter)
      const verses: Record<string, { word: string; code: string }[]> = {}
      for (const [verseNum, pairs] of Object.entries(wordsByVerse)) {
        verses[String(verseNum)] = pairs
      }
      return NextResponse.json({ verses })
    }

    const strongsByVerse = await getStrongsForChapter(bookRef, chapter)
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
