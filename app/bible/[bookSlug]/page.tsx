import Link from "next/link"
import { notFound } from "next/navigation"

import { getBookBySlug, listChapters } from "@/lib/bible/api"

export const revalidate = 3600

export default async function BibleBookPage({ params }: { params: { bookSlug: string } }) {
  const book = await getBookBySlug(params.bookSlug)
  if (!book) {
    notFound()
  }

  let chapters = await listChapters(book.id)
  chapters = chapters.sort((a, b) => a.number - b.number)

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-16 pt-10">
        <header className="space-y-3">
          <Link href="/bible" className="text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent">
            ← All books
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{book.name}</h1>
          {book.nameLong && book.nameLong !== book.name && (
            <p className="text-sm text-muted-foreground">{book.nameLong}</p>
          )}
        </header>

        {chapters.length === 0 ? (
          <div className="rounded-lg border border-border bg-card/60 p-4 text-sm text-muted-foreground">
            Chapters are not available for this book yet.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
            {chapters.map((chapter) => (
              <Link
                key={chapter.id}
                href={`/bible/${book.slug}/${chapter.number}`}
                className="flex h-12 items-center justify-center rounded-md border border-border bg-card/70 text-sm font-medium text-foreground transition hover:border-accent/60 hover:bg-card"
              >
                {chapter.number}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
