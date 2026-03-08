import Link from "next/link"
import { notFound } from "next/navigation"
import { getStudyBySlugAsync } from "@/lib/studies"
import { getGuideContent as readGuideContent, getFirstPassageRefFromContent } from "@/lib/studies-content"
import { StudyGuideShell } from "./study-guide-shell"
import { ArrowLeft, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react"

export const revalidate = 3600
export const runtime = "nodejs"

type Props = {
  params: Promise<{ studySlug: string; guideSlug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { studySlug, guideSlug } = await params
  const study = await getStudyBySlugAsync(studySlug)
  const guide = study?.guideLinks.find((g) => g.slug === guideSlug)
  if (!study || !guide) return { title: "Study guide" }
  return {
    title: `${guide.label} | ${study.title}`,
    description: study.summary,
  }
}

export default async function StudyGuidePage({ params }: Props) {
  const { studySlug, guideSlug } = await params
  const study = await getStudyBySlugAsync(studySlug)
  const guide = study?.guideLinks.find((g) => g.slug === guideSlug)

  if (!study || !guide) notFound()

  const content = await readGuideContent(studySlug, guideSlug)
  const defaultPassageRef =
    guide.defaultPassageRef ?? (content ? getFirstPassageRefFromContent(content) : null)

  const guideIndex = study.guideLinks.findIndex((g) => g.slug === guideSlug)
  const prevGuide = guideIndex > 0 ? study.guideLinks[guideIndex - 1] : null
  const nextGuide = guideIndex < study.guideLinks.length - 1 ? study.guideLinks[guideIndex + 1] : null

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="grid-bg fixed inset-0 opacity-20 pointer-events-none" aria-hidden="true" />
      <div className="relative z-10 pt-[var(--navbar-offset)] h-[calc(100dvh-var(--navbar-offset))] overflow-y-auto overflow-x-hidden">
        <div className="px-4 sm:px-8 md:px-12 max-w-4xl mx-auto lg:max-w-none">
          <header className="mb-8 sm:mb-12 pb-8 sm:pb-10 border-b border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5 sm:mb-6">
              <Link
                href="/studies"
                className="inline-flex items-center gap-2 font-mono text-[11px] sm:text-xs tracking-[0.25em] text-white/50 hover:text-white/90 active:text-white transition-colors uppercase min-h-[44px] sm:min-h-0"
              >
                <ArrowLeft className="size-3.5" />
                Back to Studies
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                {study.substackUrl ? (
                  <a
                    href={study.substackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-mono text-[11px] sm:text-xs tracking-widest uppercase text-white/50 hover:text-amber-200/90 active:text-amber-200 transition-colors border border-white/20 hover:border-amber-500/40 px-3 py-2 rounded min-h-[44px] sm:min-h-0 shrink-0"
                  >
                    {study.leader === "jason" ? "Jason's notes on Substack" : "Leader notes on Substack"}
                    <ExternalLink className="size-3" />
                  </a>
                ) : null}
                {guide.url ? (
                  <a
                    href={guide.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-mono text-[11px] sm:text-xs tracking-widest uppercase text-white/50 hover:text-amber-200/90 active:text-amber-200 transition-colors border border-white/20 hover:border-amber-500/40 px-3 py-2 rounded min-h-[44px] sm:min-h-0 shrink-0"
                  >
                    Open on Notion
                    <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </div>
            </div>
            <p className="font-mono text-[10px] sm:text-xs tracking-[0.3em] text-amber-200/80 mb-2 uppercase">
              {study.title}
            </p>
            <h1 className="font-sans text-2xl sm:text-4xl md:text-5xl font-light italic leading-[1.15] text-white mb-3 sm:mb-4">
              {guide.label}
            </h1>
            <p className="font-sans text-xs sm:text-sm md:text-base text-white/50 font-light leading-relaxed">
              <span className="hidden lg:inline">Click a verse to view it in the sidebar. Hover to preview.</span>
              <span className="lg:hidden">Tap a verse reference to read the passage.</span>
            </p>

            {/* Guide navigation pills */}
            {study.guideLinks.length > 1 && (
              <div className="mt-4 sm:mt-5 flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                {study.guideLinks.map((g, i) => {
                  const isCurrent = g.slug === guideSlug
                  const href = g.slug ? `/studies/${study.slug}/${g.slug}` : g.url
                  const isLocal = !!g.slug
                  const Wrapper = isLocal ? Link : "a"
                  return (
                    <Wrapper
                      key={g.slug ?? g.url}
                      href={href}
                      {...(!isLocal && { target: "_blank", rel: "noopener noreferrer" })}
                      className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] tracking-wider uppercase transition-colors min-h-[32px] ${
                        isCurrent
                          ? "bg-amber-500/15 border border-amber-500/40 text-amber-200"
                          : "border border-white/10 text-white/50 hover:border-white/25 hover:text-white/80 active:bg-white/5"
                      }`}
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold">
                        {i + 1}
                      </span>
                      <span className="hidden sm:inline">{g.label.replace(/^Wk \d+:\s*/, "").slice(0, 20)}{g.label.replace(/^Wk \d+:\s*/, "").length > 20 ? "…" : ""}</span>
                      <span className="sm:hidden">Wk {i + 1}</span>
                    </Wrapper>
                  )
                })}
              </div>
            )}
          </header>

          {content ? (
            <StudyGuideShell content={content} defaultPassageRef={defaultPassageRef} />
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

          {/* Previous / Next navigation */}
          {(prevGuide || nextGuide) && (
            <div className="flex items-center justify-between gap-3 border-t border-white/10 mt-12 pt-6 pb-12">
              {prevGuide ? (
                <Link
                  href={prevGuide.slug ? `/studies/${study.slug}/${prevGuide.slug}` : prevGuide.url}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 active:bg-white/15 px-4 py-3 font-mono text-xs text-white/80 transition-colors min-h-[48px]"
                >
                  <ChevronLeft className="size-4 text-white/50" />
                  <span className="truncate max-w-[120px] sm:max-w-none">{prevGuide.label}</span>
                </Link>
              ) : <div />}
              {nextGuide ? (
                <Link
                  href={nextGuide.slug ? `/studies/${study.slug}/${nextGuide.slug}` : nextGuide.url}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10 active:bg-amber-500/15 px-4 py-3 font-mono text-xs text-amber-200/90 transition-colors min-h-[48px]"
                >
                  <span className="truncate max-w-[120px] sm:max-w-none">{nextGuide.label}</span>
                  <ChevronRight className="size-4 text-amber-400/60" />
                </Link>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
