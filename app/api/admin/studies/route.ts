import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  const auth = await requireAdmin()
  if ("response" in auth) return auth.response

  const supabase = createSupabaseAdminClient()
  const { data: studies, error } = await supabase
    .from("bible_studies")
    .select("*, study_guides(*)")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const sorted = (studies ?? []).map((s: Record<string, unknown>) => ({
    ...s,
    study_guides: ((s.study_guides as Record<string, unknown>[]) ?? []).sort(
      (a: Record<string, unknown>, b: Record<string, unknown>) =>
        ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0)
    ),
  }))

  return NextResponse.json({ studies: sorted })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ("response" in auth) return auth.response

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }
  const { title, slug, notion_url, summary, podcast_url, vault_url, substack_url, tags, year, is_current, leader, guides } = body

  const titleStr = typeof title === "string" ? title.trim() : ""
  const slugRaw = typeof slug === "string" ? slug.trim() : ""
  if (!titleStr) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 })
  }
  const slugSafe = slugRaw || titleStr.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "study"
  const tagsArray = Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : []

  const supabase = createSupabaseAdminClient()

  if (is_current) {
    await supabase.from("bible_studies").update({ is_current: false }).eq("is_current", true)
  }

  const leaderVal =
    leader === "mat" || leader === "jason" ? leader : null

  const { data: study, error: studyError } = await supabase
    .from("bible_studies")
    .insert({
      title: titleStr,
      slug: slugSafe,
      notion_url: typeof notion_url === "string" ? notion_url.trim() || "" : "",
      summary: typeof summary === "string" ? summary.trim() || "" : "",
      podcast_url: typeof podcast_url === "string" ? podcast_url.trim() || null : null,
      vault_url: typeof vault_url === "string" ? vault_url.trim() || null : null,
      substack_url: typeof substack_url === "string" ? substack_url.trim() || null : null,
      tags: tagsArray,
      year: typeof year === "number" && Number.isFinite(year) ? year : null,
      is_current: !!is_current,
      leader: leaderVal,
    })
    .select()
    .single()

  if (studyError) {
    return NextResponse.json({ error: studyError.message }, { status: 500 })
  }

  const studyId = study?.id
  if (!studyId || typeof studyId !== "string") {
    return NextResponse.json({ error: "Study insert did not return an id." }, { status: 500 })
  }

  if (guides && Array.isArray(guides) && guides.length > 0) {
    const guideRows = guides.map((g: Record<string, unknown>, i: number) => {
      const rawSlug = typeof g.slug === "string" ? g.slug.trim() : ""
      const rawLabel = typeof g.label === "string" ? g.label.trim() : ""
      const safeSlug = (rawSlug.replace(/[^a-z0-9-]/gi, "") || "").trim() || `wk-${i + 1}`
      return {
        study_id: studyId,
        slug: safeSlug,
        label: rawLabel || `Week ${i + 1}`,
        notion_url: typeof g.notion_url === "string" ? g.notion_url.trim() || "" : "",
        default_passage_ref: typeof g.default_passage_ref === "string" ? g.default_passage_ref.trim() || null : null,
        content_md: typeof g.content_md === "string" ? g.content_md : null,
        sort_order: i,
      }
    })
    const { error: insertError } = await supabase.from("study_guides").insert(guideRows)
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ study })
}
