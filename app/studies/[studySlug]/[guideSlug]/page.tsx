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
    <main className="relative min-h-screen">
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
      <div className="relative z-10 pt-[var(--navbar-offset)] pb-24 pl-4 sm:pl-6 md:pl-12 pr-4 sm:pr-6 md:pr-12">
        <header className="max-w-3xl mb-8">
          <Link
            href="/studies"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent transition-colors mb-6"
          >
            <ArrowLeft className="size-3" />
            Back to studies
          </Link>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent mb-1">
            {study.title}
          </p>
          <h1 className="font-[var(--font-bebas)] text-3xl md:text-4xl tracking-tight text-foreground">
            {guide.label}
          </h1>
          <a
            href={guide.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors"
          >
            Open on Notion
            <ExternalLink className="size-3" />
          </a>
        </header>

        {content ? (
          <article className="w-full min-w-0 study-guide prose overflow-x-hidden">
            <StudyGuideContent content={content} />
          </article>
        ) : (
          <div className="max-w-xl">
            <p className="font-mono text-sm text-muted-foreground mb-4">
              This guide is not yet hosted here. Open it on Notion to read.
            </p>
            <a
              href={guide.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-accent hover:underline"
            >
              Open on Notion
              <ExternalLink className="size-4" />
            </a>
          </div>
        )}
      </div>
    </main>
  )
}
