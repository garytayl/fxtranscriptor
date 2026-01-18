import { NextRequest, NextResponse } from "next/server"

import { getBookBySlug, getChapterVerses, listChapters } from "@/lib/bible/api"
import { parsePassageReference } from "@/lib/bible/reference"
import { getResolvedTranslationByKey } from "@/lib/bible/translations"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const ref = searchParams.get("ref")
  const translationKey = searchParams.get("t") ?? undefined

  if (!ref) {
    return NextResponse.json({ error: "Reference is required." }, { status: 400 })
  }

  const parsed = parsePassageReference(ref)
  if (!parsed) {
    return NextResponse.json({ error: "Unable to parse reference." }, { status: 400 })
  }

  try {
    const translation = await getResolvedTranslationByKey(translationKey)
    const book = await getBookBySlug(parsed.bookSlug, translation?.bibleId)
    if (!book) {
      return NextResponse.json({ error: `Book "${parsed.book}" not found.` }, { status: 404 })
    }

    const chapters = await listChapters(book.id, translation?.bibleId)
    const chapter = chapters.find((item) => item.number === parsed.chapterNumber)
    if (!chapter) {
      return NextResponse.json(
        { error: `Chapter ${parsed.chapterNumber} not found for ${book.name}.` },
        { status: 404 }
      )
    }

    const chapterResponse = await getChapterVerses(
      { chapterId: chapter.id, bookId: book.id },
      translation?.bibleId
    )

    const verses = parsed.verseRange
      ? chapterResponse.verses.filter(
          (verse) =>
            verse.number >= parsed.verseRange!.start && verse.number <= parsed.verseRange!.end
        )
      : chapterResponse.verses

    return NextResponse.json({
      reference: parsed.raw,
      translation: translation?.label ?? "Default",
      chapterReference: chapterResponse.chapter.reference,
      verses,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load passage."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
