import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ studyId: string }> }) {
  const auth = await requireAdmin()
  if ("response" in auth) return auth.response

  const { studyId } = await params
  const body = await req.json()
  const supabase = createSupabaseAdminClient()

  const { guides, ...studyFields } = body

  if (studyFields.is_current) {
    await supabase.from("bible_studies").update({ is_current: false }).eq("is_current", true)
  }

  if (Object.keys(studyFields).length > 0) {
    const { error } = await supabase.from("bible_studies").update(studyFields).eq("id", studyId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (guides && Array.isArray(guides)) {
    await supabase.from("study_guides").delete().eq("study_id", studyId)
    if (guides.length > 0) {
      const rows = guides.map((g: Record<string, unknown>, i: number) => {
        const rawSlug = typeof g.slug === "string" ? g.slug.trim() : ""
        const rawLabel = typeof g.label === "string" ? g.label.trim() : ""
        return {
          study_id: studyId,
          slug: rawSlug || `wk-${i + 1}`,
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
