import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft, Search, BookOpen } from "lucide-react"

import { TranslationSettings } from "@/app/bible/_components/translation-settings"
import { getBooksByTestamentWithId } from "@/lib/bible/api"
import { getResolvedTranslations, getResolvedTranslationByKey } from "@/lib/bible/translations"

export const revalidate = 3600

type Book = { name: string; slug: string; nameLong?: string }

function BookGrid({
  title,
  books,
  translationKey,
}: {
  title: string
  books: Book[]
  translationKey?: string | null
}) {
  if (books.length === 0) return null
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

function TestamentChoice({
  translationKey,
  onOld,
  onNew,
}: {
  translationKey: string | null
  onOld: string
  onNew: string
}) {
  const t = translationKey ? `?t=${translationKey}` : ""
  return (
    <div className="flex flex-col gap-3 max-w-md">
      <Link
        href={onOld}
        className="flex items-center gap-3 rounded-xl border border-border bg-card/70 p-4 sm:p-5 transition hover:border-accent/60 hover:bg-card active:border-accent/70"
      >
        <BookOpen className="size-5 text-muted-foreground shrink-0" aria-hidden />
        <span className="font-semibold text-foreground">Old Testament</span>
      </Link>
      <Link
        href={onNew}
        className="flex items-center gap-3 rounded-xl border border-border bg-card/70 p-4 sm:p-5 transition hover:border-accent/60 hover:bg-card active:border-accent/70"
      >
        <BookOpen className="size-5 text-muted-foreground shrink-0" aria-hidden />
        <span className="font-semibold text-foreground">New Testament</span>
      </Link>
    </div>
  )
}

function QuickAccess({
  books,
  translationKey,
}: {
  books: Book[]
  translationKey: string | null
}) {
  if (books.length === 0) return null
  const query = translationKey ? `?t=${translationKey}` : ""
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Quick access</h2>
      <div className="flex flex-wrap gap-2">
        {books.map((book) => (
          <Link
            key={book.slug}
            href={`/bible/${book.slug}${query}`}
            className="rounded-lg border border-border bg-card/60 px-3 py-2 text-sm font-medium text-foreground transition hover:border-accent/50 hover:bg-card"
          >
            {book.name}
          </Link>
        ))}
      </div>
    </section>
  )
}

export default async function BibleIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[]; testament?: string | string[] }>
}) {
  const resolved = await searchParams
  const translationKey = Array.isArray(resolved.t) ? resolved.t[0] : resolved.t
  const testament = Array.isArray(resolved.testament) ? resolved.testament[0] : resolved.testament
  const translations = await getResolvedTranslations()
  const translation = await getResolvedTranslationByKey(translationKey)
  const activeKey = translation?.key ?? translationKey ?? null
  let errorMessage: string | null = null
  let oldTestament: Book[] = []
  let newTestament: Book[] = []
  let other: Book[] = []

  try {
    const data = await getBooksByTestamentWithId(translation?.bibleId)
    oldTestament = data.oldTestament
    newTestament = data.newTestament
    other = data.other
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unable to load books."
  }

  const hasGroupedTestaments = oldTestament.length > 0 && newTestament.length > 0
  const showTestamentFirst = hasGroupedTestaments && !testament
  const tParam = activeKey ? `&t=${activeKey}` : ""

  const quickBooks: Book[] = []
  if (hasGroupedTestaments) {
    const psalms = oldTestament.find((b) => b.slug.toLowerCase() === "psalms")
    const matthew = newTestament.find((b) => b.slug.toLowerCase() === "matthew")
    const john = newTestament.find((b) => b.slug.toLowerCase() === "john")
    if (psalms) quickBooks.push(psalms)
    if (matthew) quickBooks.push(matthew)
    if (john) quickBooks.push(john)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 sm:gap-10 px-4 pb-16 pt-[var(--navbar-offset)]">
        <header className="space-y-2 sm:space-y-3">
          {testament ? (
            <Link
              href={`/bible${activeKey ? `?t=${activeKey}` : ""}`}
              className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent min-h-[44px] sm:min-h-0"
            >
              <ArrowLeft className="size-3" />
              All books
            </Link>
          ) : (
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent min-h-[44px] sm:min-h-0"
            >
              <ArrowLeft className="size-3" />
              Back to home
            </Link>
          )}
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.4em] text-muted-foreground">Scripture Reader</p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">Bible</h1>
          <p className="max-w-2xl text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {testament
              ? testament === "old"
                ? "Choose a book from the Old Testament."
                : "Choose a book from the New Testament."
              : "Ad-free, privacy-first Bible reading. Look up a passage or choose a testament."}
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <Suspense
              fallback={<div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground">Translation: ...</div>}
            >
              <TranslationSettings translations={translations} currentKey={activeKey} />
            </Suspense>
            <Link
              href={`/bible/search${activeKey ? `?t=${activeKey}` : ""}`}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3.5 py-2 text-[11px] sm:text-xs font-medium uppercase tracking-[0.15em] text-foreground/90 transition hover:border-accent/50 hover:bg-accent/10 hover:text-accent min-h-[44px] sm:min-h-0"
            >
              <Search className="size-3.5 shrink-0" aria-hidden />
              Look up passage
            </Link>
          </div>
        </header>

        {errorMessage ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : showTestamentFirst ? (
          <div className="space-y-10">
            <QuickAccess books={quickBooks} translationKey={activeKey} />
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Browse by testament</h2>
              <TestamentChoice
                translationKey={activeKey}
                onOld={`/bible?testament=old${tParam}`}
                onNew={`/bible?testament=new${tParam}`}
              />
            </section>
          </div>
        ) : testament === "old" || testament === "new" ? (
          <div className="space-y-8">
            <BookGrid
              title={testament === "old" ? "Old Testament" : "New Testament"}
              books={testament === "old" ? oldTestament : newTestament}
              translationKey={activeKey}
            />
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
