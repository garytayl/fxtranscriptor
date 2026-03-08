import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ studyId: string }> }) {
  const auth = await requireAdmin()
  if ("response" in auth) return auth.response

  const { studyId } = await params
  const studyIdClean = String(studyId).trim()
  if (!studyIdClean || studyIdClean.length < 10) {
    return NextResponse.json({ error: "Invalid study id." }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }
  const supabase = createSupabaseAdminClient()
  const { guides, ...rest } = body

  const studyFields: Record<string, unknown> = {}
  if (typeof rest.title === "string") studyFields.title = rest.title.trim()
  if (typeof rest.slug === "string") {
    const slugRaw = rest.slug.trim() || (typeof rest.title === "string" ? rest.title : "")
    studyFields.slug = (slugRaw && slugRaw.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-|-$/g, "")) || "study"
  }
  if (typeof rest.notion_url === "string") studyFields.notion_url = rest.notion_url.trim() || ""
  if (typeof rest.summary === "string") studyFields.summary = rest.summary.trim() || ""
  if (typeof rest.podcast_url === "string") studyFields.podcast_url = rest.podcast_url.trim() || null
  else if (rest.podcast_url === null) studyFields.podcast_url = null
  if (typeof rest.vault_url === "string") studyFields.vault_url = rest.vault_url.trim() || null
  else if (rest.vault_url === null) studyFields.vault_url = null
  if (typeof rest.substack_url === "string") studyFields.substack_url = rest.substack_url.trim() || null
  else if (rest.substack_url === null) studyFields.substack_url = null
  if (Array.isArray(rest.tags)) studyFields.tags = rest.tags.map((t) => String(t).trim()).filter(Boolean)
  if (typeof rest.year === "number" && Number.isFinite(rest.year)) studyFields.year = rest.year
  else if (rest.year === null) studyFields.year = null
  if (typeof rest.is_current === "boolean") studyFields.is_current = rest.is_current
  if (rest.leader === "mat" || rest.leader === "jason") studyFields.leader = rest.leader
  else if (rest.leader === null || rest.leader === "") studyFields.leader = null

  if (studyFields.is_current) {
    await supabase.from("bible_studies").update({ is_current: false }).eq("is_current", true)
  }

  if (Object.keys(studyFields).length > 0) {
    const { error } = await supabase.from("bible_studies").update(studyFields).eq("id", studyIdClean)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (guides && Array.isArray(guides)) {
    await supabase.from("study_guides").delete().eq("study_id", studyIdClean)
    if (guides.length > 0) {
      const rows = guides.map((g: Record<string, unknown>, i: number) => {
        const rawSlug = typeof g.slug === "string" ? g.slug.trim() : ""
        const rawLabel = typeof g.label === "string" ? g.label.trim() : ""
        const safeSlug = (rawSlug.replace(/[^a-z0-9-]/gi, "") || "").trim() || `wk-${i + 1}`
        return {
          study_id: studyIdClean,
          slug: safeSlug,
          label: rawLabel || `Week ${i + 1}`,
          notion_url: typeof g.notion_url === "string" ? g.notion_url.trim() || "" : "",
          default_passage_ref: typeof g.default_passage_ref === "string" ? g.default_passage_ref.trim() || null : null,
          content_md: typeof g.content_md === "string" ? g.content_md : null,
          sort_order: i,
        }
      })
      const { error } = await supabase.from("study_guides").insert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ studyId: string }> }) {
  const auth = await requireAdmin()
  if ("response" in auth) return auth.response

  const { studyId } = await params
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from("bible_studies").delete().eq("id", studyId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
