import { NextRequest, NextResponse } from "next/server"

const DEFAULT_SUBSTACK_FEED = "https://jasondavidsnyder.substack.com/feed"
const MAX_POSTS = 5
const CACHE_SECONDS = 600 // 10 min

export type SubstackPost = { title: string; link: string; pubDate: string }

/** GET /api/studies/substack-feed?url=... — returns recent posts from a Substack RSS feed. */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")?.trim() || DEFAULT_SUBSTACK_FEED
  if (!url.startsWith("https://") || !url.includes("substack.com")) {
    return NextResponse.json({ error: "Invalid Substack URL" }, { status: 400 })
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "fxarchives/1.0 (studies)" },
      next: { revalidate: CACHE_SECONDS },
    })
    if (!res.ok) return NextResponse.json({ posts: [], error: "Feed unavailable" }, { status: 200 })
    const xml = await res.text()
    const posts = parseRssItems(xml).slice(0, MAX_POSTS)
    return NextResponse.json({ posts }, {
      headers: { "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}` },
    })
  } catch {
    return NextResponse.json({ posts: [] }, { status: 200 })
  }
}

function parseRssItems(xml: string): SubstackPost[] {
  const out: SubstackPost[] = []
  const itemRe = /<item>([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1]
    const title = extractTag(block, "title")
    const link = extractTag(block, "link")
    const pubDate = extractTag(block, "pubDate")
    if (title && link) out.push({ title, link, pubDate: pubDate || "" })
  }
  return out
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i")
  const m = block.match(re)
  if (!m) return ""
  return (m[1] || "").replace(/<!\[CDATA\[([\s\S]*?)]]>/, "$1").trim()
}
