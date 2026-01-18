import { NextResponse } from "next/server"

import { getBooksByTestament } from "@/lib/bible/api"

export const runtime = "nodejs"

export async function GET() {
  try {
    const { oldTestament, newTestament, other } = await getBooksByTestament()
    return NextResponse.json({ oldTestament, newTestament, other })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load books."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
