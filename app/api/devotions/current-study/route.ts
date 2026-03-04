import { NextResponse } from "next/server"
import { getCurrentStudyAsync } from "@/lib/studies"
import { getGuideContent } from "@/lib/studies-content"

export const runtime = "nodejs"

export async function GET() {
  try {
    const study = await getCurrentStudyAsync()
    if (!study) {
      return NextResponse.json({ error: "No current study configured." }, { status: 404 })
    }

    const guidesWithSlugs = study.guideLinks.filter((g) => g.slug)
    if (guidesWithSlugs.length === 0) {
      return NextResponse.json({
        error: "No hosted study guides available — check Notion instead.",
        notionUrl: study.notionUrl,
      }, { status: 404 })
    }

    const latestGuide = guidesWithSlugs[guidesWithSlugs.length - 1]
    const content = await getGuideContent(study.slug, latestGuide.slug!)

    if (!content) {
      return NextResponse.json({
        error: "Study guide content not found.",
        notionUrl: latestGuide.url,
      }, { status: 404 })
    }

    return NextResponse.json({
      studyTitle: study.title,
      studySlug: study.slug,
      guideLabel: latestGuide.label,
      guideSlug: latestGuide.slug,
      content,
      defaultPassageRef: latestGuide.defaultPassageRef ?? null,
      notionUrl: latestGuide.url,
      allGuides: guidesWithSlugs.map((g) => ({
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
