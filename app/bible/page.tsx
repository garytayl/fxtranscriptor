import Link from "next/link"

import { TranslationSelect } from "@/app/bible/_components/translation-select"
import { getBooksByTestamentWithId } from "@/lib/bible/api"
import { getAvailableTranslations, getTranslationByKey } from "@/lib/bible/translations"

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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {books.map((book) => (
          <Link
            key={book.slug}
            href={`/bible/${book.slug}${query}`}
            className="group flex h-full flex-col justify-between rounded-lg border border-border bg-card/70 p-4 transition hover:border-accent/60 hover:bg-card"
          >
            <div className="space-y-1">
              <p className="text-lg font-semibold text-foreground">{book.name}</p>
              {book.nameLong && book.nameLong !== book.name && (
                <p className="text-xs text-muted-foreground">{book.nameLong}</p>
              )}
            </div>
            <span className="mt-3 text-xs uppercase tracking-[0.2em] text-muted-foreground group-hover:text-accent">
              View chapters -&gt;
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
  searchParams: { t?: string | string[] }
}) {
  const translationKey = Array.isArray(searchParams.t) ? searchParams.t[0] : searchParams.t
  const translations = getAvailableTranslations()
  const translation = getTranslationByKey(translationKey)
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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-16 pt-10">
        <header className="space-y-3">
          <Link href="/" className="text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent">
            &lt;- Back to home
          </Link>
          <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Scripture Reader</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Bible</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Ad-free, privacy-first Bible reading. Choose a book to begin.
          </p>
          <TranslationSelect translations={translations} currentKey={activeKey} />
          <Link
            href={`/bible/search${activeKey ? `?t=${activeKey}` : ""}`}
            className="text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent"
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
