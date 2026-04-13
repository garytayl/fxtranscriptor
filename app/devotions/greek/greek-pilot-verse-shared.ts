"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import {
  MORPH_PILOT_CHAPTERS,
  morphPilotPassageRef,
  morphPilotReaderUrl,
  type MorphPilotChapterMenuItem,
} from "@/lib/bible/morph-pilot-menu"
import { FX_GREEK_GRAMMAR_TRANSLATION_KEY } from "@/lib/bible/reader-translation-keys"
import type { GreekMorphToken } from "@/lib/bible/morph-types"

export const GREEK_PLACE_STORAGE_KEY = "fx_devotions_greek_place_v1"

export const VERSE_SWIPE_MIN_X = 84
export const VERSE_SWIPE_HORIZONTAL_RATIO = 1.35
export const MENU_SWIPE_CLOSE_THRESHOLD = 72
export const DETAIL_SWIPE_CLOSE_THRESHOLD = 102
export const DETAIL_SWIPE_CLOSE_VELOCITY = 0.72

export type StoredPlace = { bookSlug: string; chapter: number; verse: number }
export type PassageVerse = { number: number; text: string }

export function loadGreekPilotPlace(): StoredPlace | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(GREEK_PLACE_STORAGE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as StoredPlace
    if (!p?.bookSlug || typeof p.chapter !== "number" || typeof p.verse !== "number") return null
    return p
  } catch {
    return null
  }
}

export function saveGreekPilotPlace(p: StoredPlace) {
  try {
    window.localStorage.setItem(GREEK_PLACE_STORAGE_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

export function stripHtmlTags(s: string): string {
  return s.replace(/<[^>]+>/g, "")
}

export function useGreekPilotVerse() {
  const [pilotIdx, setPilotIdx] = useState(0)
  const [verse, setVerse] = useState(1)
  const [rolodexBookSlug, setRolodexBookSlug] = useState(MORPH_PILOT_CHAPTERS[0]?.bookSlug ?? "john")
  const [rolodexChapter, setRolodexChapter] = useState(MORPH_PILOT_CHAPTERS[0]?.chapter ?? 1)
  const [rolodexVerse, setRolodexVerse] = useState(1)
  const [hydrated, setHydrated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [english, setEnglish] = useState("")
  const [greekTokens, setGreekTokens] = useState<GreekMorphToken[]>([])

  const pilot: MorphPilotChapterMenuItem = MORPH_PILOT_CHAPTERS[pilotIdx] ?? MORPH_PILOT_CHAPTERS[0]
  const passageRef = useMemo(() => morphPilotPassageRef(pilot, verse), [pilot, verse])
  const readerUrl = useMemo(
    () => morphPilotReaderUrl(pilot.bookSlug, pilot.chapter, verse),
    [pilot.bookSlug, pilot.chapter, verse],
  )

  const rolodexBooks = useMemo(() => {
    const seen = new Set<string>()
    return MORPH_PILOT_CHAPTERS.filter((item) => {
      if (seen.has(item.bookSlug)) return false
      seen.add(item.bookSlug)
      return true
    }).map((item) => ({
      bookSlug: item.bookSlug,
      bookName: item.bookName,
    }))
  }, [])
  const rolodexChapters = useMemo(
    () => MORPH_PILOT_CHAPTERS.filter((item) => item.bookSlug === rolodexBookSlug),
    [rolodexBookSlug],
  )
  const selectedRolodexChapter =
    rolodexChapters.find((item) => item.chapter === rolodexChapter) ?? rolodexChapters[0] ?? pilot
  const rolodexVerseOptions = useMemo(
    () => Array.from({ length: selectedRolodexChapter.maxVerse }, (_, idx) => idx + 1),
    [selectedRolodexChapter.maxVerse],
  )

  useEffect(() => {
    const s = loadGreekPilotPlace()
    if (s) {
      const idx = MORPH_PILOT_CHAPTERS.findIndex((c) => c.bookSlug === s.bookSlug && c.chapter === s.chapter)
      if (idx >= 0) {
        setPilotIdx(idx)
        const max = MORPH_PILOT_CHAPTERS[idx].maxVerse
        setVerse(Math.min(Math.max(1, s.verse), max))
      }
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    saveGreekPilotPlace({ bookSlug: pilot.bookSlug, chapter: pilot.chapter, verse })
  }, [hydrated, pilot.bookSlug, pilot.chapter, verse])

  useEffect(() => {
    setRolodexBookSlug(pilot.bookSlug)
    setRolodexChapter(pilot.chapter)
    setRolodexVerse(verse)
  }, [pilot.bookSlug, pilot.chapter, verse])

  useEffect(() => {
    if (!hydrated) return

    const controller = new AbortController()
    const ref = passageRef
    const t = FX_GREEK_GRAMMAR_TRANSLATION_KEY

    setLoading(true)
    setError(null)

    const load = async () => {
      try {
        const [passRes, morphRes] = await Promise.all([
          fetch(`/api/bible/passage?ref=${encodeURIComponent(ref)}&t=${encodeURIComponent(t)}`, {
            signal: controller.signal,
          }),
          fetch(`/api/bible/morph?ref=${encodeURIComponent(ref)}`, { signal: controller.signal }),
        ])
        const pass = (await passRes.json()) as Record<string, unknown>
        const morph = (await morphRes.json()) as Record<string, unknown>

        let passError: string | null = null
        let nextEnglish = ""
        if (!passRes.ok) {
          passError = typeof pass.error === "string" ? pass.error : "Could not load this verse."
        } else if (typeof pass.error === "string" && pass.error) {
          passError = pass.error
        } else {
          const verses = pass.verses as PassageVerse[] | undefined
          const row = verses?.find((v) => v.number === verse) ?? verses?.[0]
          nextEnglish = row?.text ? stripHtmlTags(row.text).replace(/\s+/g, " ").trim() : ""
        }

        let morphError: string | null = null
        let nextGreekTokens: GreekMorphToken[] = []
        if (!morphRes.ok) {
          morphError = typeof morph.error === "string" ? morph.error : "Could not load Greek morphology."
        } else if (typeof morph.error === "string" && morph.error && morph.available === false) {
          morphError = morph.error
        } else {
          const mVerses = morph.verses as { number: number; tokens: GreekMorphToken[] }[] | undefined
          const mv = mVerses?.find((x) => x.number === verse) ?? mVerses?.[0]
          nextGreekTokens = mv?.tokens ?? []
          if (nextGreekTokens.length === 0) morphError = "Could not load Greek morphology."
        }

        setEnglish(nextEnglish)
        setGreekTokens(nextGreekTokens)

        if (passError && nextGreekTokens.length > 0) {
          setError("English translation unavailable right now. Greek grammar study is still available.")
        } else if (!passError && morphError && nextEnglish) {
          setError("Greek morphology unavailable for this verse.")
        } else if (passError) {
          setError(passError)
        } else if (morphError) {
          setError(morphError)
        } else {
          setError(null)
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError("Could not load this verse.")
        setEnglish("")
        setGreekTokens([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [hydrated, passageRef, verse])

  const prevVerse = useCallback(() => {
    setVerse((v) => Math.max(1, v - 1))
  }, [])

  const nextVerse = useCallback(() => {
    setVerse((v) => Math.min(pilot.maxVerse, v + 1))
  }, [pilot.maxVerse])

  const applyRolodexSelection = useCallback(() => {
    const targetPilotIdx = MORPH_PILOT_CHAPTERS.findIndex(
      (item) => item.bookSlug === rolodexBookSlug && item.chapter === rolodexChapter,
    )
    if (targetPilotIdx < 0) return
    const targetPilot = MORPH_PILOT_CHAPTERS[targetPilotIdx]
    const safeVerse = Math.min(Math.max(1, rolodexVerse), targetPilot.maxVerse)
    setPilotIdx(targetPilotIdx)
    setVerse(safeVerse)
  }, [rolodexBookSlug, rolodexChapter, rolodexVerse])

  return {
    pilotIdx,
    setPilotIdx,
    verse,
    setVerse,
    pilot,
    passageRef,
    readerUrl,
    hydrated,
    loading,
    error,
    english,
    greekTokens,
    prevVerse,
    nextVerse,
    rolodexBookSlug,
    setRolodexBookSlug,
    rolodexChapter,
    setRolodexChapter,
    rolodexVerse,
    setRolodexVerse,
    rolodexBooks,
    rolodexChapters,
    selectedRolodexChapter,
    rolodexVerseOptions,
    applyRolodexSelection,
  }
}
