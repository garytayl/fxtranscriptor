import { NextResponse } from "next/server"

import { getSection } from "@/lib/devotions-sections"
import { listChapters, getBooksWithSlugs } from "@/lib/bible/api"
import { getResolvedTranslationByKey } from "@/lib/bible/translations"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  context: { params: Promise<{ sectionId: string }> }
) {
  const params = await context.params
  const sectionId = params?.sectionId
  if (!sectionId) {
    return NextResponse.json({ error: "Section id is required." }, { status: 400 })
  }

  const section = getSection(sectionId)
  if (!section) {
    return NextResponse.json({ error: "Section not found." }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const t = searchParams.get("t") ?? undefined
  try {
    const translation = await getResolvedTranslationByKey(t || null)
    const allBooks = await getBooksWithSlugs(translation?.bibleId)
    const bookIdToName = new Map(allBooks.map((b) => [b.id, b.name]))

    const books: { bookId: string; name: string; chapterCount: number }[] = []
    let totalChapters = 0
    for (const bookId of section.bookIds) {
      const chapters = await listChapters(bookId, translation?.bibleId)
      const chapterCount = chapters.length
      totalChapters += chapterCount
      books.push({
        bookId,
        name: bookIdToName.get(bookId) ?? bookId,
        chapterCount,
      })
    }

    return NextResponse.json({
      sectionId: section.id,
      label: section.label,
      books,
      totalChapters,
      /** Days to complete at 1 chapter per day. */
      daysAt1ChapterPerDay: totalChapters,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load section meta."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
