import Link from "next/link"

import { getBooksByTestament } from "@/lib/bible/api"

export const revalidate = 3600

function BookGrid({ title, books }: { title: string; books: { name: string; slug: string; nameLong?: string }[] }) {
  if (books.length === 0) {
    return null
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {books.map((book) => (
          <Link
            key={book.slug}
            href={`/bible/${book.slug}`}
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

export default async function BibleIndexPage() {
  let errorMessage: string | null = null
  let oldTestament: { name: string; slug: string; nameLong?: string }[] = []
  let newTestament: { name: string; slug: string; nameLong?: string }[] = []
  let other: { name: string; slug: string; nameLong?: string }[] = []

  try {
    const data = await getBooksByTestament()
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
        </header>

        {errorMessage ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : (
          <div className="space-y-12">
            {hasGroupedTestaments ? (
              <>
                <BookGrid title="Old Testament" books={oldTestament} />
                <BookGrid title="New Testament" books={newTestament} />
              </>
            ) : (
              <BookGrid title="Books" books={[...oldTestament, ...newTestament, ...other]} />
            )}
            {other.length > 0 && hasGroupedTestaments && <BookGrid title="Other" books={other} />}
          </div>
        )}
      </div>
    </main>
  )
}
