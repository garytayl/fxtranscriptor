import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"

import { TranslationSettings } from "@/app/bible/_components/translation-settings"
import { getBooksByTestamentWithId } from "@/lib/bible/api"
import { getResolvedTranslations, getResolvedTranslationByKey } from "@/lib/bible/translations"

export const revalidate = 3600

function BookGrid({
  title,
  books,
  translationKey,
}: {
  title: string
  books: { name: string; slug: string; nameLong?: string }[]
  translationKey?: string | null
}) {
  if (books.length === 0) {
    return null
  }

  const query = translationKey ? `?t=${translationKey}` : ""

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">{title}</h2>
      <div className="grid gap-2.5 sm:gap-3 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3">
        {books.map((book) => (
          <Link
            key={book.slug}
            href={`/bible/${book.slug}${query}`}
            className="group flex h-full flex-col justify-between rounded-lg border border-border bg-card/70 p-3 sm:p-4 transition hover:border-accent/60 hover:bg-card active:border-accent/70 min-h-[60px]"
          >
            <div className="space-y-0.5">
              <p className="text-sm sm:text-lg font-semibold text-foreground leading-tight">{book.name}</p>
              {book.nameLong && book.nameLong !== book.name && (
                <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">{book.nameLong}</p>
              )}
            </div>
            <span className="mt-1.5 sm:mt-3 text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground group-hover:text-accent">
              View →
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default async function BibleIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[] }>
}) {
  const resolvedSearchParams = await searchParams
  const translationKey = Array.isArray(resolvedSearchParams.t) ? resolvedSearchParams.t[0] : resolvedSearchParams.t
  const translations = await getResolvedTranslations()
  const translation = await getResolvedTranslationByKey(translationKey)
  const activeKey = translation?.key ?? translationKey ?? null
  let errorMessage: string | null = null
  let oldTestament: { name: string; slug: string; nameLong?: string }[] = []
  let newTestament: { name: string; slug: string; nameLong?: string }[] = []
  let other: { name: string; slug: string; nameLong?: string }[] = []

  try {
    const data = await getBooksByTestamentWithId(translation?.bibleId)
    oldTestament = data.oldTestament
    newTestament = data.newTestament
    other = data.other
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unable to load books."
  }

  const hasGroupedTestaments = oldTestament.length > 0 && newTestament.length > 0

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 sm:gap-10 px-4 pb-16 pt-[var(--navbar-offset)]">
        <header className="space-y-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent min-h-[44px] sm:min-h-0"
          >
            <ArrowLeft className="size-3" />
            Back to home
          </Link>
          <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Scripture Reader</p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">Bible</h1>
          <p className="max-w-2xl text-xs sm:text-sm text-muted-foreground">
            Ad-free, privacy-first Bible reading. Choose a book to begin.
          </p>
          <Suspense
            fallback={<div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Translation: ...</div>}
          >
            <TranslationSettings translations={translations} currentKey={activeKey} />
          </Suspense>
          <Link
            href={`/bible/search${activeKey ? `?t=${activeKey}` : ""}`}
            className="inline-flex items-center text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent min-h-[44px] sm:min-h-0"
          >
            Search scripture -&gt;
          </Link>
        </header>

        {errorMessage ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : (
          <div className="space-y-12">
            {hasGroupedTestaments ? (
              <>
                <BookGrid title="Old Testament" books={oldTestament} translationKey={activeKey} />
                <BookGrid title="New Testament" books={newTestament} translationKey={activeKey} />
              </>
            ) : (
              <BookGrid
                title="Books"
                books={[...oldTestament, ...newTestament, ...other]}
                translationKey={activeKey}
              />
            )}
            {other.length > 0 && hasGroupedTestaments && (
              <BookGrid title="Other" books={other} translationKey={activeKey} />
            )}
          </div>
        )}
      </div>
    </main>
  )
}
