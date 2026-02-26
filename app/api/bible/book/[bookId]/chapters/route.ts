import { NextResponse } from "next/server"

import { listChapters } from "@/lib/bible/api"
import { getResolvedTranslationByKey } from "@/lib/bible/translations"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  context: { params: Promise<{ bookId: string }> }
) {
  const params = await context.params
  const bookId = params?.bookId
  if (!bookId) {
    return NextResponse.json({ error: "Book id is required." }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const t = searchParams.get("t") ?? undefined
  try {
    const translation = await getResolvedTranslationByKey(t || null)
    const chapters = await listChapters(bookId, translation?.bibleId)
    return NextResponse.json({ chapters })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load chapters."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
