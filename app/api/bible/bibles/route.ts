import { NextResponse } from "next/server"

import { listAllBibles } from "@/lib/bible/api"

export const runtime = "nodejs"

/**
 * GET /api/bible/bibles — list all bibles your API key can access.
 * Shows configured BSB/WEBU IDs and whether they're allowed; suggests exact IDs to use if not.
 */
export async function GET() {
  try {
    const bibles = await listAllBibles()
    const list = bibles.map((b) => ({ id: b.id, name: b.name, abbreviation: b.abbreviation }))
    const ids = new Set(list.map((b) => b.id))

    const configuredBsb = process.env.API_BIBLE_BSB_ID ?? ""
    const configuredWebu = process.env.API_BIBLE_WEBU_ID ?? ""

    const bsbMatch = list.find(
      (b) =>
        /berean standard/i.test(b.name) ||
        (b.abbreviation && /^BSB$/i.test(b.abbreviation))
    )
    const webuMatch = list.find(
      (b) =>
        /world english/i.test(b.name) ||
        (b.abbreviation && /^WEB(U)?$/i.test(b.abbreviation ?? ""))
    )

    const useJsonInstead =
      !bsbMatch || !webuMatch
        ? "Berean Standard Bible is not in your key's list. Use API_BIBLE_TRANSLATIONS_JSON with two bibles from the list above (e.g. WEBU + World English Bible). See .env.example."
        : null

    return NextResponse.json({
      bibles: list,
      configured: {
        API_BIBLE_BSB_ID: configuredBsb || "(not set)",
        API_BIBLE_WEBU_ID: configuredWebu || "(not set)",
      },
      validation: {
        bsbIdAllowed: configuredBsb ? ids.has(configuredBsb) : false,
        webuIdAllowed: configuredWebu ? ids.has(configuredWebu) : false,
      },
      useTheseIds: {
        API_BIBLE_BSB_ID: bsbMatch?.id ?? "(not available on your plan)",
        API_BIBLE_WEBU_ID: webuMatch?.id ?? "(not available on your plan)",
      },
      hint: useJsonInstead ?? "Copy useTheseIds into your .env (API_BIBLE_BSB_ID, API_BIBLE_WEBU_ID), then restart the dev server.",
      ...(useJsonInstead && webuMatch
        ? {
            apiBibleTranslationsJsonExample: [
              { key: "webu", label: "World English Bible Updated", bibleId: webuMatch.id },
              {
                key: "web",
                label: "World English Bible",
                bibleId: list.find((b) => /^World English Bible$/i.test(b.name) && !/updated/i.test(b.name))?.id ?? "9879dbb7cfe39e4d-01",
              },
            ],
          }
        : {}),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to list bibles."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
