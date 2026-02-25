import Link from "next/link"
import { getCurrentStudy, getAllStudies } from "@/lib/studies"
import { ExternalLink, Headphones, BookOpen, FileText } from "lucide-react"

export const revalidate = 3600

export const metadata = {
  title: "Bible Studies",
  description: "FX Church Bible studies and small group guides. Study guides hosted on Notion.",
}

export default function StudiesPage() {
  const current = getCurrentStudy()
  const all = getAllStudies()

  return (
    <main className="relative min-h-screen">
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
      <div className="relative z-10 pt-[var(--navbar-offset)] pb-24 pl-4 sm:pl-6 md:pl-12 pr-4 sm:pr-6 md:pr-12">
        <header className="max-w-3xl mb-12 md:mb-16">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent transition-colors mb-6"
          >
            ← Back to home
          </Link>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent mb-2">Bible Studies</p>
          <h1 className="font-[var(--font-bebas)] text-4xl md:text-6xl tracking-tight">
            Study Guides
          </h1>
          <p className="mt-4 font-mono text-sm text-muted-foreground leading-relaxed max-w-xl">
            Small group and personal study guides from FX Church. Hosted on Notion — open any link to read or print.
          </p>
        </header>

        {current ? (
          <section className="max-w-3xl space-y-10">
            {/* Current study card */}
            <article className="border border-border bg-card/50 rounded-lg overflow-hidden">
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-accent">Current study</span>
                  {current.tags?.length ? (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      #{current.tags.join(" #")}
                    </span>
                  ) : null}
                </div>
                <h2 className="font-[var(--font-bebas)] text-3xl md:text-4xl tracking-tight text-foreground">
                  {current.title}
                </h2>
                <p className="mt-4 font-mono text-sm text-muted-foreground leading-relaxed">
                  {current.summary}
                </p>

                {/* Notion main page */}
                <a
                  href={current.notionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-accent hover:underline"
                >
                  <BookOpen className="size-4" />
                  Open full study on Notion
                  <ExternalLink className="size-3" />
                </a>

                {/* Study guides by week */}
                <div className="mt-8">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
                    Study guides
                  </h3>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {current.guideLinks.map((guide, i) => (
                      <li key={guide.url}>
                        <a
                          href={guide.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-3 border border-border bg-background/50 hover:border-accent/50 rounded-lg px-4 py-3 font-mono text-sm transition-colors"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">
                            {i + 1}
                          </span>
                          <span className="flex-1 min-w-0 truncate group-hover:text-accent transition-colors">
                            {guide.label}
                          </span>
                          <ExternalLink className="size-3 shrink-0 text-muted-foreground group-hover:text-accent" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Podcast + Vault */}
                <div className="mt-8 pt-6 border-t border-border flex flex-wrap gap-4">
                  {current.podcastUrl ? (
                    <a
                      href={current.podcastUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors"
                    >
                      <Headphones className="size-4" />
                      Series podcast
                    </a>
                  ) : null}
                  {current.vaultUrl ? (
                    <a
                      href={current.vaultUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors"
                    >
                      <FileText className="size-4" />
                      re:group vault
                    </a>
                  ) : null}
                </div>
              </div>
            </article>

            {/* Archive: other studies */}
            {all.length > 1 ? (
              <div>
                <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
                  Other studies
                </h3>
                <ul className="space-y-3">
                  {all
                    .filter((s) => s.id !== current.id)
                    .map((study) => (
                      <li key={study.id}>
                        <a
                          href={study.notionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block border border-border bg-card/30 hover:border-accent/40 rounded-lg px-4 py-3 font-mono text-sm transition-colors"
                        >
                          <span className="text-foreground">{study.title}</span>
                          {study.year ? (
                            <span className="ml-2 text-muted-foreground">({study.year})</span>
                          ) : null}
                          <ExternalLink className="inline-block size-3 ml-2 text-muted-foreground" />
                        </a>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : (
          <div className="max-w-xl">
            <p className="font-mono text-sm text-muted-foreground">
              No studies configured yet. Add entries to <code className="text-accent">lib/studies.ts</code> to list
              Notion study guides here.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
