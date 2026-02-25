import { NextRequest, NextResponse } from "next/server"
import { getStrongsEntry, parseStrongsCode } from "@/lib/bible/lexicon"

export const runtime = "nodejs"
/** Allow time for first request to fetch full OpenScriptures dictionary from CDN. */
export const maxDuration = 60

/**
 * GET /api/bible/lexicon/[code]
 * Returns a single Strong's entry by code (e.g. G26, H3045).
 * When the entry is not found (e.g. OpenScriptures fetch failed), returns 200 with a stub so clients avoid 404 noise.
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
  if (entry) {
    return NextResponse.json(entry)
  }

  const parsed = parseStrongsCode(code)
  const language = parsed?.language ?? "hebrew"
  const stub: { code: string; lemma: string; meaning: string; language: "greek" | "hebrew" } = {
    code: code.toUpperCase(),
    lemma: "",
    meaning: "Definition not available.",
    language,
  }
  return NextResponse.json(stub)
}
