import { NextResponse } from "next/server"

import { listAllBibles } from "@/lib/bible/api"

export const runtime = "nodejs"

/**
 * GET /api/bible/bibles — list all bibles your API key can access.
 * Use this to get the exact id values for API_BIBLE_BSB_ID and API_BIBLE_WEBU_ID
 * (copy from the response; 403 means an id you're using isn't in this list).
 */
export async function GET() {
  try {
    const bibles = await listAllBibles()
    return NextResponse.json({
      bibles: bibles.map((b) => ({ id: b.id, name: b.name, abbreviation: b.abbreviation })),
      hint: "Set API_BIBLE_BSB_ID and API_BIBLE_WEBU_ID to the 'id' of Berean Standard Bible and World English Bible (Updated) from this list.",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to list bibles."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
