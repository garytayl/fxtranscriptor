import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"
import { notFound } from "next/navigation"

import { TranslationSelect } from "@/app/bible/_components/translation-select"
import { getBookBySlug, listChapters } from "@/lib/bible/api"
import { getAvailableTranslations, getTranslationByKey } from "@/lib/bible/translations"

export const revalidate = 3600

export default async function BibleBookPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookSlug: string }>
  searchParams: { t?: string | string[] }
}) {
  const resolvedParams = await params
  const translationKey = Array.isArray(searchParams.t) ? searchParams.t[0] : searchParams.t
  const translations = getAvailableTranslations()
  const translation = getTranslationByKey(translationKey)
  const activeKey = translation?.key ?? translationKey ?? null

  const book = await getBookBySlug(resolvedParams.bookSlug, translation?.bibleId)
  if (!book) {
    notFound()
  }

  let chapters = await listChapters(book.id, translation?.bibleId)
  chapters = chapters.sort((a, b) => a.number - b.number)
  const query = activeKey ? `?t=${activeKey}` : ""

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-16 pt-10">
        <header className="space-y-3">
          <Link
            href={`/bible${query}`}
            className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent"
          >
            <ArrowLeft className="size-3" />
            All books
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{book.name}</h1>
          {book.nameLong && book.nameLong !== book.name && (
            <p className="text-sm text-muted-foreground">{book.nameLong}</p>
          )}
          <Suspense
            fallback={<div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Translation: ...</div>}
          >
            <TranslationSelect translations={translations} currentKey={activeKey} />
          </Suspense>
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
                href={`/bible/${book.slug}/${chapter.number}${query}`}
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
