import { NextRequest, NextResponse } from "next/server"

import { getBookBySlug } from "@/lib/bible/api"
import { getVersesForPassageReference } from "@/lib/bible/passage-verses"
import { parsePassageReference, formatPassageReferenceForDisplay } from "@/lib/bible/reference"
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

    const { verses, error: sliceError } = await getVersesForPassageReference(
      parsed,
      book.id,
      translation?.bibleId
    )
    if (sliceError) {
      return NextResponse.json({ error: sliceError }, { status: 404 })
    }

    const outOfRangeMessage =
      verses.length === 0 && parsed.verseRange
        ? parsed.crossChapterEnd
          ? `No verses found for ${formatPassageReferenceForDisplay(parsed)}.`
          : `${book.name} ${parsed.chapterNumber} may not include those verses.`
        : undefined

    return NextResponse.json({
      reference: formatPassageReferenceForDisplay(parsed),
      translation: translation?.label ?? "Default",
      verses,
      ...(outOfRangeMessage && { error: outOfRangeMessage }),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load passage."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
