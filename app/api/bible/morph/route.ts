import { NextRequest, NextResponse } from "next/server"

import { getMorphologyForPassage } from "@/lib/bible/morph-lookup"
import { formatPassageReferenceForDisplay, parsePassageReference } from "@/lib/bible/reference"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref")
  if (!ref) {
    return NextResponse.json({ error: "Reference is required." }, { status: 400 })
  }

  const parsed = parsePassageReference(ref)
  if (!parsed) {
    return NextResponse.json({ error: "Unable to parse reference." }, { status: 400 })
  }

  const payload = getMorphologyForPassage(parsed)
  return NextResponse.json({
    reference: formatPassageReferenceForDisplay(parsed),
    ...payload,
  })
}
