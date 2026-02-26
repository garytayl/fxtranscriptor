import { NextResponse } from "next/server"

import { getBooksByTestamentWithId } from "@/lib/bible/api"
import { getResolvedTranslationByKey } from "@/lib/bible/translations"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const t = searchParams.get("t") ?? undefined
  try {
    const translation = await getResolvedTranslationByKey(t || null)
    const { oldTestament, newTestament, other } = await getBooksByTestamentWithId(translation?.bibleId)
    return NextResponse.json({ oldTestament, newTestament, other })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load books."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
