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

  const body = await req.json()
  const { title, slug, notion_url, summary, podcast_url, vault_url, tags, year, is_current, guides } = body

  if (!title || !slug) {
    return NextResponse.json({ error: "Title and slug are required." }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()

  if (is_current) {
    await supabase.from("bible_studies").update({ is_current: false }).eq("is_current", true)
  }

  const { data: study, error: studyError } = await supabase
    .from("bible_studies")
    .insert({
      title,
      slug,
      notion_url: notion_url || "",
      summary: summary || "",
      podcast_url: podcast_url || null,
      vault_url: vault_url || null,
      tags: tags || [],
      year: year || null,
      is_current: is_current || false,
    })
    .select()
    .single()

  if (studyError) {
    return NextResponse.json({ error: studyError.message }, { status: 500 })
  }

  if (guides && Array.isArray(guides) && guides.length > 0) {
    const guideRows = guides.map((g: Record<string, unknown>, i: number) => ({
      study_id: study.id,
      slug: g.slug || `wk-${i + 1}`,
      label: g.label || `Week ${i + 1}`,
      notion_url: g.notion_url || "",
      default_passage_ref: g.default_passage_ref || null,
      content_md: g.content_md || null,
      sort_order: i,
    }))
    await supabase.from("study_guides").insert(guideRows)
  }

  return NextResponse.json({ study })
}
