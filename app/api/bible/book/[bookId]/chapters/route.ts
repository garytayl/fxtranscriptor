import { NextResponse } from "next/server"

import { listChapters } from "@/lib/bible/api"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ bookId: string }> }
) {
  const params = await context.params
  const bookId = params?.bookId
  if (!bookId) {
    return NextResponse.json({ error: "Book id is required." }, { status: 400 })
  }

  try {
    const chapters = await listChapters(bookId)
    return NextResponse.json({ chapters })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load chapters."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
