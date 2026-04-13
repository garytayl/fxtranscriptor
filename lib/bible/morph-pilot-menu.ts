/**
 * MorphGNT pilot chapters exposed for “learn Greek” flows (client-safe).
 */

import { FX_GREEK_GRAMMAR_TRANSLATION_KEY } from "@/lib/bible/reader-translation-keys"

export type MorphPilotChapterMenuItem = {
  bookSlug: string
  /** Canonical book name for passage/morph API refs (e.g. "John", "Luke") */
  bookName: string
  chapter: number
  label: string
  /** Short line for the picker */
  tagline: string
  maxVerse: number
}

export const MORPH_PILOT_CHAPTERS: MorphPilotChapterMenuItem[] = [
  {
    bookSlug: "john",
    bookName: "John",
    chapter: 1,
    label: "John 1",
    tagline: "In the beginning was the Word…",
    maxVerse: 51,
  },
  {
    bookSlug: "john",
    bookName: "John",
    chapter: 2,
    label: "John 2",
    tagline: "Water to wine and temple cleansing.",
    maxVerse: 25,
  },
  {
    bookSlug: "john",
    bookName: "John",
    chapter: 3,
    label: "John 3",
    tagline: "New birth and God's love for the world.",
    maxVerse: 36,
  },
  {
    bookSlug: "john",
    bookName: "John",
    chapter: 4,
    label: "John 4",
    tagline: "Living water and true worship.",
    maxVerse: 54,
  },
  {
    bookSlug: "john",
    bookName: "John",
    chapter: 5,
    label: "John 5",
    tagline: "Healing at Bethesda and witness about Jesus.",
    maxVerse: 47,
  },
  {
    bookSlug: "john",
    bookName: "John",
    chapter: 6,
    label: "John 6",
    tagline: "Bread of life discourse.",
    maxVerse: 71,
  },
  {
    bookSlug: "john",
    bookName: "John",
    chapter: 7,
    label: "John 7",
    tagline: "Feast of Booths and living water promise.",
    maxVerse: 53,
  },
  {
    bookSlug: "john",
    bookName: "John",
    chapter: 8,
    label: "John 8",
    tagline: "Light of the world and truth that frees.",
    maxVerse: 59,
  },
  {
    bookSlug: "john",
    bookName: "John",
    chapter: 9,
    label: "John 9",
    tagline: "The man born blind receives sight.",
    maxVerse: 41,
  },
  {
    bookSlug: "john",
    bookName: "John",
    chapter: 10,
    label: "John 10",
    tagline: "The good shepherd discourse.",
    maxVerse: 42,
  },
  {
    bookSlug: "luke",
    bookName: "Luke",
    chapter: 6,
    label: "Luke 6",
    tagline: "Sabbath, beatitudes, love your enemies…",
    maxVerse: 49,
  },
]

/** Single-verse ref for `/api/bible/passage` and `/api/bible/morph` (e.g. `John 1:3`). */
export function morphPilotPassageRef(pilot: MorphPilotChapterMenuItem, verse: number): string {
  return `${pilot.bookName} ${pilot.chapter}:${verse}`
}

/** Opens the full scripture reader with Greek morphology + KJV line (`fx-greek`). */
export function morphPilotReaderUrl(bookSlug: string, chapter: number, verse: number): string {
  const params = new URLSearchParams()
  params.set("t", FX_GREEK_GRAMMAR_TRANSLATION_KEY)
  params.set("v", String(verse))
  return `/bible/${bookSlug}/${chapter}?${params.toString()}`
}
