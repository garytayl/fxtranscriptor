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
      const rows = guides.map((g: Record<string, unknown>, i: number) => ({
        study_id: studyId,
        slug: g.slug || `wk-${i + 1}`,
        label: g.label || `Week ${i + 1}`,
        notion_url: g.notion_url || "",
        default_passage_ref: g.default_passage_ref || null,
        content_md: g.content_md || null,
        sort_order: i,
      }))
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
