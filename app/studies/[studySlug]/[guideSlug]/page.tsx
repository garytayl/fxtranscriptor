import Link from "next/link"
import { notFound } from "next/navigation"
import { getStudyBySlug } from "@/lib/studies"
import { getGuideContent as readGuideContent, getFirstPassageRefFromContent } from "@/lib/studies-content"
import { StudyGuideShell } from "./study-guide-shell"
import { ArrowLeft, ExternalLink } from "lucide-react"

export const revalidate = 3600
export const runtime = "nodejs"

type Props = {
  params: Promise<{ studySlug: string; guideSlug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { studySlug, guideSlug } = await params
  const study = getStudyBySlug(studySlug)
  const guide = study?.guideLinks.find((g) => g.slug === guideSlug)
  if (!study || !guide) return { title: "Study guide" }
  return {
    title: `${guide.label} | ${study.title}`,
    description: study.summary,
  }
}

export default async function StudyGuidePage({ params }: Props) {
  const { studySlug, guideSlug } = await params
  const study = getStudyBySlug(studySlug)
  const guide = study?.guideLinks.find((g) => g.slug === guideSlug)

  if (!study || !guide) notFound()

  const content = await readGuideContent(studySlug, guideSlug)
  const defaultPassageRef =
    guide.defaultPassageRef ?? (content ? getFirstPassageRefFromContent(content) : null)

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="grid-bg fixed inset-0 opacity-20 pointer-events-none" aria-hidden="true" />
      <div className="relative z-10">
        <header className="mb-12 px-4 sm:px-8 md:px-12 max-w-4xl mx-auto lg:pr-[calc(22rem+3rem)] pb-10 border-b border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <Link
              href="/studies"
              className="inline-flex items-center gap-2 font-mono text-[11px] sm:text-xs tracking-[0.25em] text-white/50 hover:text-white/90 transition-colors uppercase"
            >
              <ArrowLeft className="size-3.5" />
              Back to studies
            </Link>
            <a
              href={guide.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-mono text-[11px] sm:text-xs tracking-widest uppercase text-white/50 hover:text-amber-200/90 transition-colors border border-white/20 hover:border-amber-500/40 px-3 py-2 rounded"
            >
              Open on Notion
              <ExternalLink className="size-3" />
            </a>
          </div>
          <p className="font-mono text-[10px] sm:text-xs tracking-[0.3em] text-amber-200/80 mb-2 uppercase">
            {study.title}
          </p>
          <h1 className="font-sans text-3xl sm:text-4xl md:text-5xl font-light italic leading-[1.15] text-white mb-4">
            {guide.label}
          </h1>
          <p className="font-sans text-sm sm:text-base text-white/60 font-light leading-relaxed max-w-2xl">
            Click a verse to view it in the sidebar. Hover to preview.
          </p>
        </header>

        {content ? (
          <StudyGuideShell content={content} defaultPassageRef={defaultPassageRef} />
        ) : (
            <div className="max-w-xl px-4 sm:px-8 md:px-12">
              <p className="font-sans text-base text-white/70 font-light leading-relaxed mb-4">
                This guide is not yet hosted here. Open it on Notion to read.
              </p>
              <a
                href={guide.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-sans text-sm text-amber-200/90 hover:text-amber-200 underline underline-offset-2"
              >
                Open on Notion
                <ExternalLink className="size-4" />
              </a>
            </div>
          )}
      </div>
    </div>
  )
}
