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
    bookSlug: "john",
    bookName: "John",
    chapter: 11,
    label: "John 11",
    tagline: "Lazarus raised and many believe.",
    maxVerse: 57,
  },
  {
    bookSlug: "john",
    bookName: "John",
    chapter: 12,
    label: "John 12",
    tagline: "Anointing at Bethany and triumphal entry.",
    maxVerse: 50,
  },
  {
    bookSlug: "john",
    bookName: "John",
    chapter: 13,
    label: "John 13",
    tagline: "Foot washing and the new commandment.",
    maxVerse: 38,
  },
  {
    bookSlug: "john",
    bookName: "John",
    chapter: 14,
    label: "John 14",
    tagline: "Comfort, way to the Father, promised Helper.",
    maxVerse: 31,
  },
  {
    bookSlug: "john",
    bookName: "John",
    chapter: 15,
    label: "John 15",
    tagline: "Vine and branches, love and witness.",
    maxVerse: 27,
  },
  {
    bookSlug: "john",
    bookName: "John",
    chapter: 16,
    label: "John 16",
    tagline: "Spirit's work and sorrow turned to joy.",
    maxVerse: 33,
  },
  {
    bookSlug: "john",
    bookName: "John",
    chapter: 17,
    label: "John 17",
    tagline: "Jesus' high priestly prayer.",
    maxVerse: 26,
  },
  {
    bookSlug: "john",
    bookName: "John",
    chapter: 18,
    label: "John 18",
    tagline: "Arrest, trials, and Peter's denial.",
    maxVerse: 40,
  },
  {
    bookSlug: "john",
    bookName: "John",
    chapter: 19,
    label: "John 19",
    tagline: "Crucifixion, death, and burial of Jesus.",
    maxVerse: 42,
  },
  {
    bookSlug: "john",
    bookName: "John",
    chapter: 20,
    label: "John 20",
    tagline: "Resurrection appearances and belief.",
    maxVerse: 31,
  },
  {
    bookSlug: "john",
    bookName: "John",
    chapter: 21,
    label: "John 21",
    tagline: "Breakfast by the sea and Peter restored.",
    maxVerse: 25,
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
