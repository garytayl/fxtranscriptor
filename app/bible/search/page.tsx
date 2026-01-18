import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"

import { PassageSearch } from "@/app/bible/_components/passage-search"
import { TranslationSelect } from "@/app/bible/_components/translation-select"
import { getBookBySlug, getBooksWithSlugs, getChapterVerses, listChapters } from "@/lib/bible/api"
import { parsePassageList, isVerseInRange } from "@/lib/bible/reference"
import { getResolvedTranslations, getResolvedTranslationByKey } from "@/lib/bible/translations"

export const revalidate = 3600

type SearchPageProps = {
  searchParams: {
    refs?: string | string[]
    t?: string | string[]
  }
}

export default async function BibleSearchPage({ searchParams }: SearchPageProps) {
  const refsParam = Array.isArray(searchParams.refs) ? searchParams.refs[0] : searchParams.refs
  const translationParam = Array.isArray(searchParams.t) ? searchParams.t[0] : searchParams.t
  const translations = await getResolvedTranslations()
  const translation = await getResolvedTranslationByKey(translationParam)
  const activeKey = translation?.key ?? translationParam ?? null

  const passages = refsParam ? parsePassageList(refsParam) : []
  const books = await getBooksWithSlugs(translation?.bibleId)

  const results = await Promise.all(
    passages.map(async (passage) => {
      const book = await getBookBySlug(passage.bookSlug, translation?.bibleId)
      if (!book) {
        return { passage, error: `Book "${passage.book}" was not found.` }
      }

      const chapters = await listChapters(book.id, translation?.bibleId)
      const chapter = chapters.find((item) => item.number === passage.chapterNumber)
      if (!chapter) {
        return {
          passage,
          error: `Chapter ${passage.chapterNumber} was not found for ${book.name}.`,
        }
      }

      try {
        const chapterResponse = await getChapterVerses(
          { chapterId: chapter.id, bookId: book.id },
          translation?.bibleId
        )
        const verses = passage.verseRange
          ? chapterResponse.verses.filter((verse) => isVerseInRange(verse.number, passage.verseRange))
          : chapterResponse.verses
        return {
          passage,
          book,
          chapterNumber: chapter.number,
          reference: chapterResponse.chapter.reference,
          verses,
        }
      } catch (error) {
        return {
          passage,
          error: error instanceof Error ? error.message : "Unable to load passage.",
        }
      }
    })
  )

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-16 pt-10">
        <header className="space-y-3">
          <Link
            href={`/bible${activeKey ? `?t=${activeKey}` : ""}`}
            className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent"
          >
            <ArrowLeft className="size-3" />
            Back to Bible
          </Link>
          <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Scripture Reader</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Scripture Search</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Search by reference or build a list of passages to display together.
          </p>
          <Suspense
            fallback={<div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Translation: ...</div>}
          >
            <TranslationSelect translations={translations} currentKey={activeKey} />
          </Suspense>
        </header>

        <PassageSearch
          initialRefs={refsParam ?? ""}
          translationKey={activeKey}
          books={books}
        />

        {refsParam && results.length === 0 && (
          <div className="rounded-lg border border-border bg-card/60 p-4 text-sm text-muted-foreground">
            No valid references found. Try something like “John 3:16-18; Romans 8:1”.
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-8">
            {results.map((result, index) => (
              <section key={`${result.passage.raw}-${index}`} className="rounded-lg border border-border bg-card/60 p-6">
                <header className="space-y-2">
                  <h2 className="text-lg font-semibold text-foreground">
                    {result.passage.raw}
                  </h2>
                  {result.reference && (
                    <p className="text-sm text-muted-foreground">{result.reference}</p>
                  )}
                </header>
                {result.error ? (
                  <p className="mt-4 text-sm text-destructive">{result.error}</p>
                ) : result.verses && result.verses.length > 0 ? (
                  <ol className="mt-4 space-y-3 text-base leading-relaxed">
                    {result.verses.map((verse) => (
                      <li key={verse.number} className="rounded-md px-3 py-2 text-foreground">
                        <span className="mr-2 align-super text-xs font-semibold text-muted-foreground">
                          {verse.number}
                        </span>
                        <span>{verse.text}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">No verses available for this passage.</p>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
