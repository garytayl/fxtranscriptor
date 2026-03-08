import Link from "next/link"
import type { BibleStudy } from "@/lib/studies"
import { getStudiesByLeaderAsync, getAllStudiesAsync } from "@/lib/studies"
import { getGroupsByTrack, type SmallGroup } from "@/lib/small-groups"
import { ExternalLink, Headphones, BookOpen, FileText, ChevronRight } from "lucide-react"
import { SubstackNotesBlock } from "./substack-notes-block"

export const revalidate = 3600

export const metadata = {
  title: "Bible Studies",
  description: "fxchurch Bible studies and small group guides. Mat's and Jason's studies.",
}

function studyPrimaryHref(study: BibleStudy): { href: string; isExternal: boolean; label: string } {
  const firstGuide = study.guideLinks.find((g) => g.slug)
  if (firstGuide?.slug) {
    return { href: `/studies/${study.slug}/${firstGuide.slug}`, isExternal: false, label: "Open study guides" }
  }
  if (study.notionUrl) {
    return { href: study.notionUrl, isExternal: true, label: "Open full study on Notion" }
  }
  return { href: "#", isExternal: false, label: "Study guides" }
}

function StudyCard({
  leaderLabel,
  study,
  groups,
}: {
  leaderLabel: string
  study: BibleStudy | null
  groups: SmallGroup[]
}) {
  if (!study) {
    return (
      <article className="border border-border bg-card/30 rounded-lg overflow-hidden">
        <div className="p-4 sm:p-6 md:p-8">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{leaderLabel}</span>
          <h2 className="font-display text-xl sm:text-2xl tracking-tight text-foreground mt-2">
            {leaderLabel}
          </h2>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {leaderLabel === "Jason's study"
              ? "Snyder's uses Jason's discussion questions. Same series material."
              : "No study assigned yet."}
          </p>
          {groups.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                Groups using this study
              </p>
              <ul className="font-mono text-sm text-muted-foreground space-y-1">
                {groups.map((g) => (
                  <li key={g.name}>{g.name} — {g.schedule}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </article>
    )
  }

  const primary = studyPrimaryHref(study)
  const PrimaryLink = primary.isExternal ? "a" : Link

  return (
    <article className="border border-border bg-card/50 rounded-lg overflow-hidden">
      <div className="p-4 sm:p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-accent">{leaderLabel}</span>
          {study.tags?.length ? (
            <span className="font-mono text-[10px] text-muted-foreground">#{study.tags.join(" #")}</span>
          ) : null}
        </div>
        <h2 className="font-display text-2xl sm:text-3xl md:text-4xl tracking-tight text-foreground">
          {study.title}
        </h2>
        <p className="mt-3 sm:mt-4 font-mono text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {study.summary}
        </p>

        <PrimaryLink
          href={primary.href}
          {...(primary.isExternal && { target: "_blank", rel: "noopener noreferrer" })}
          className="mt-5 sm:mt-6 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-accent hover:underline min-h-[44px] sm:min-h-0"
        >
          <BookOpen className="size-4" />
          {primary.label}
          {primary.isExternal ? <ExternalLink className="size-3" /> : <ChevronRight className="size-3" />}
        </PrimaryLink>

        <div className="mt-6 sm:mt-8">
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3 sm:mb-4">
            Study guides
          </h3>
          <ul className="grid gap-2.5 sm:gap-3 sm:grid-cols-2">
            {study.guideLinks.map((guide, i) => {
              const href = guide.slug ? `/studies/${study.slug}/${guide.slug}` : guide.url
              const isLocal = !!guide.slug
              const Wrapper = isLocal ? Link : "a"
              return (
                <li key={guide.url}>
                  <Wrapper
                    href={href}
                    {...(!isLocal && { target: "_blank", rel: "noopener noreferrer" })}
                    className="group flex items-center gap-3 border border-border bg-background/50 hover:border-accent/50 active:border-accent/70 rounded-lg px-3 sm:px-4 py-3.5 sm:py-3 font-mono text-sm transition-colors min-h-[52px]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="flex-1 min-w-0 text-sm leading-snug group-hover:text-accent transition-colors">
                      {guide.label}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground group-hover:text-accent transition-colors" />
                  </Wrapper>
                </li>
              )
            })}
          </ul>
        </div>

        {groups.length > 0 && (
          <div className="mt-6 pt-5 border-t border-border">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Groups using this study
            </p>
            <ul className="font-mono text-xs text-muted-foreground space-y-1">
              {groups.map((g) => (
                <li key={g.name}>
                  {g.name} — {g.schedule}
                  {g.link ? (
                    <>
                      {" · "}
                      <a
                        href={g.link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline inline-flex items-center gap-0.5"
                      >
                        {g.link.label}
                        <ExternalLink className="size-3" />
                      </a>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}

        {study.substackUrl ? (
          <SubstackNotesBlock
            substackUrl={study.substackUrl}
            feedUrl={study.substackUrl.replace(/\/?$/, "/feed")}
          />
        ) : null}

        <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-border flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
          {study.podcastUrl ? (
            <a
              href={study.podcastUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors min-h-[44px] sm:min-h-0"
            >
              <Headphones className="size-4" />
              Series podcast
            </a>
          ) : null}
          {study.vaultUrl ? (
            <a
              href={study.vaultUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors min-h-[44px] sm:min-h-0"
            >
              <FileText className="size-4" />
              re:group vault
            </a>
          ) : null}
          {study.notionUrl && study.guideLinks.some((g) => g.slug) ? (
            <a
              href={study.notionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors min-h-[44px] sm:min-h-0"
            >
              <BookOpen className="size-4" />
              Open on Notion
              <ExternalLink className="size-3" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export default async function StudiesPage() {
  const { matStudy, jasonStudy } = await getStudiesByLeaderAsync()
  const all = await getAllStudiesAsync()
  const matGroups = getGroupsByTrack("mat")
  const jasonGroups = getGroupsByTrack("jason")

  const leaderIds = [matStudy?.id, jasonStudy?.id].filter(Boolean) as string[]
  const otherStudies = all.filter((s) => !leaderIds.includes(s.id))

  return (
    <main className="relative min-h-screen">
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
      <div className="relative z-10 pt-[var(--navbar-offset)] pb-24 px-4 sm:px-6 md:px-12">
        <header className="max-w-3xl mb-8 sm:mb-12 md:mb-16">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent transition-colors mb-4 sm:mb-6 min-h-[44px] sm:min-h-0"
          >
            ← Back to home
          </Link>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent mb-2">Bible Studies</p>
          <h1 className="font-display text-3xl sm:text-4xl md:text-6xl tracking-tight">
            Study Guides
          </h1>
          <p className="mt-3 sm:mt-4 font-mono text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xl">
            Two studies this term. Find your group below and open the right study.
          </p>
        </header>

        <section className="max-w-3xl space-y-8 sm:space-y-10">
          <h2 className="font-display text-xl sm:text-2xl tracking-tight text-foreground sr-only">
            Which study does your group use?
          </h2>

          <StudyCard leaderLabel="Mat's study" study={matStudy} groups={matGroups} />
          <StudyCard leaderLabel="Jason's study" study={jasonStudy} groups={jasonGroups} />

          {otherStudies.length > 0 ? (
            <div>
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3 sm:mb-4">
                Other studies
              </h3>
              <ul className="space-y-2.5 sm:space-y-3">
                {otherStudies.map((study) => {
                  const firstGuide = study.guideLinks.find((g) => g.slug)
                  const href = firstGuide?.slug
                    ? `/studies/${study.slug}/${firstGuide.slug}`
                    : study.notionUrl || "#"
                  const isExternal = !firstGuide?.slug
                  const Wrapper = isExternal && study.notionUrl ? "a" : Link
                  return (
                    <li key={study.id}>
                      <Wrapper
                        href={href}
                        {...(isExternal && study.notionUrl && { target: "_blank", rel: "noopener noreferrer" })}
                        className="block border border-border bg-card/30 hover:border-accent/40 active:border-accent/60 rounded-lg px-4 py-3.5 sm:py-3 font-mono text-sm transition-colors min-h-[48px]"
                      >
                        <span className="text-foreground">{study.title}</span>
                        {study.year ? (
                          <span className="ml-2 text-muted-foreground">({study.year})</span>
                        ) : null}
                        {isExternal && study.notionUrl ? (
                          <ExternalLink className="inline-block size-3 ml-2 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="inline-block size-3 ml-2 text-muted-foreground" />
                        )}
                      </Wrapper>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}
