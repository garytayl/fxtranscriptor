import { NextRequest, NextResponse } from "next/server"
import { getStrongsEntry } from "@/lib/bible/lexicon"

export const runtime = "nodejs"

/**
 * GET /api/bible/lexicon/[code]
 * Returns a single Strong's entry by code (e.g. G26, H3045).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  if (!code) {
    return NextResponse.json({ error: "Code is required." }, { status: 400 })
  }

  const entry = await getStrongsEntry(code)
  if (!entry) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 })
  }

  return NextResponse.json(entry)
}
