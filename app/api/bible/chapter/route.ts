import { NextRequest, NextResponse } from "next/server"

import { getChapterVerses } from "@/lib/bible/api"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const bookId = searchParams.get("book")
  const chapterParam = searchParams.get("chapter")

  if (!bookId || !chapterParam) {
    return NextResponse.json({ error: "Book and chapter parameters are required." }, { status: 400 })
  }

  const chapterNumber = Number(chapterParam)
  if (!Number.isFinite(chapterNumber)) {
    return NextResponse.json({ error: "Chapter must be a number." }, { status: 400 })
  }

  try {
    const payload = await getChapterVerses({ bookId, chapterNumber })
    return NextResponse.json(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load chapter."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
