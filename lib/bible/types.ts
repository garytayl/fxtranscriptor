export type BibleBook = {
  id: string
  name: string
  nameLong?: string
  abbreviation?: string
  slug: string
  testament: "old" | "new" | "unknown"
}

export type BibleChapter = {
  id: string
  number: number
  reference?: string
}

export type BibleChapterContent = {
  id: string
  bookId: string
  number: number
  reference: string
  content: string
}

export type BibleVerse = {
  number: number
  text: string
}
