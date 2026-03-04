import { NextRequest, NextResponse } from "next/server"
import { getAllStudiesAsync } from "@/lib/studies"
import { getGuideContent } from "@/lib/studies-content"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const studySlug = searchParams.get("study")
    const guideSlug = searchParams.get("guide")

    const allStudies = await getAllStudiesAsync()
    if (allStudies.length === 0) {
      return NextResponse.json({ error: "No studies configured." }, { status: 404 })
    }

    if (!studySlug || !guideSlug) {
      return NextResponse.json({
        studies: allStudies.map((s) => ({
          title: s.title,
          slug: s.slug,
          summary: s.summary,
          guides: s.guideLinks.map((g) => ({
            label: g.label,
            slug: g.slug,
            url: g.url,
            defaultPassageRef: g.defaultPassageRef ?? null,
          })),
        })),
      })
    }

    const study = allStudies.find((s) => s.slug === studySlug)
    if (!study) {
      return NextResponse.json({ error: "Study not found." }, { status: 404 })
    }

    const guide = study.guideLinks.find((g) => g.slug === guideSlug)
    if (!guide?.slug) {
      return NextResponse.json({ error: "Guide not found." }, { status: 404 })
    }

    const content = await getGuideContent(study.slug, guide.slug)
    if (!content) {
      return NextResponse.json({
        error: "Guide content not available yet.",
        notionUrl: guide.url,
      }, { status: 404 })
    }

    return NextResponse.json({
      studyTitle: study.title,
      studySlug: study.slug,
      guideLabel: guide.label,
      guideSlug: guide.slug,
      content,
      defaultPassageRef: guide.defaultPassageRef ?? null,
      allGuides: study.guideLinks.map((g) => ({
        label: g.label,
        slug: g.slug,
      })),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load study." },
      { status: 500 }
    )
  }
}
