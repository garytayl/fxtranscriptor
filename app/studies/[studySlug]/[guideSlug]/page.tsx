import Link from "next/link"
import { notFound } from "next/navigation"
import { getStudyBySlug } from "@/lib/studies"
import { getGuideContent as readGuideContent } from "@/lib/studies-content"
import { StudyGuideContent } from "./study-guide-content"
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

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="grid-bg fixed inset-0 opacity-20 pointer-events-none" aria-hidden="true" />
      <div className="relative z-10 px-4 sm:px-8 md:px-12 pt-[var(--navbar-offset)] pb-24 max-w-4xl mx-auto">
        <main className="min-w-0 flex-1">
          <header className="mb-10">
            <Link
              href="/studies"
              className="inline-flex items-center gap-2 font-mono text-xs sm:text-sm tracking-[0.3em] text-white/40 hover:text-white/80 transition-colors mb-6"
            >
              <ArrowLeft className="size-3" />
              Back to studies
            </Link>
            <p className="font-mono text-xs sm:text-sm tracking-[0.3em] text-white/40 mb-3 uppercase">
              {study.title}
            </p>
            <h1 className="font-sans text-3xl sm:text-4xl md:text-5xl font-light italic leading-tight mb-4">
              {guide.label}
            </h1>
            <p className="font-sans text-base sm:text-lg text-white/70 font-light leading-relaxed max-w-2xl mb-6">
              Hover a verse reference to read the passage. Open on Notion for the full guide.
            </p>
            <a
              href={guide.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-sans text-sm text-amber-200/90 hover:text-amber-200 underline underline-offset-2"
            >
              Open on Notion
              <ExternalLink className="size-3" />
            </a>
          </header>

          {content ? (
            <article className="study-guide study-guide-resonates">
              <StudyGuideContent content={content} />
            </article>
          ) : (
            <div className="max-w-xl">
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
        </main>
      </div>
    </div>
  )
}
