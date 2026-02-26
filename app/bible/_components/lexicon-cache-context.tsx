"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { StrongsEntry } from "@/lib/bible/lexicon"

type LexiconCacheContextValue = {
  /** Get entry by code; returns cached or fetches and caches. */
  getEntry: (code: string) => Promise<StrongsEntry | null>
  /** Get from cache only (no fetch). */
  getCached: (code: string) => StrongsEntry | null
}

const LexiconCacheContext = createContext<LexiconCacheContextValue | null>(null)

function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/^([GH])(\d+)$/i, (_, p: string, n: string) => `${p}${n}`)
}

export function LexiconCacheProvider({ children }: { children: ReactNode }) {
  const [cache, setCache] = useState<Map<string, StrongsEntry>>(new Map())

  const getCached = useCallback((code: string) => cache.get(normalizeCode(code)) ?? null, [cache])

  const getEntry = useCallback(
    async (code: string): Promise<StrongsEntry | null> => {
      const key = normalizeCode(code)
      const existing = cache.get(key)
      if (existing) return existing

      const res = await fetch(`/api/bible/lexicon/${encodeURIComponent(code)}`)
      if (!res.ok) return null
      const data = (await res.json()) as StrongsEntry | null
      if (data) {
        setCache((prev) => {
          const next = new Map(prev)
          next.set(key, data)
          return next
        })
      }
      return data
    },
    [cache],
  )

  const value = useMemo<LexiconCacheContextValue>(
    () => ({ getEntry, getCached }),
    [getEntry, getCached],
  )

  return (
    <LexiconCacheContext.Provider value={value}>
      {children}
    </LexiconCacheContext.Provider>
  )
}

export function useLexiconCache(): LexiconCacheContextValue {
  const ctx = useContext(LexiconCacheContext)
  if (!ctx) {
    throw new Error("useLexiconCache must be used within LexiconCacheProvider")
  }
  return ctx
}

/** Load a single Strong's entry by code using the cache. Use in sidebar/sheet. */
export function useLexiconEntry(code: string | null): {
  entry: StrongsEntry | null
  loading: boolean
  error: string | null
} {
  const { getEntry, getCached } = useLexiconCache()
  const [entry, setEntry] = useState<StrongsEntry | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) {
      setEntry(null)
      setError(null)
      setLoading(false)
      return
    }

    const cached = getCached(code)
    if (cached) {
      setEntry(cached)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setEntry(null)

    getEntry(code)
      .then((data) => {
        if (!cancelled) setEntry(data ?? null)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [code, getEntry, getCached])

  return { entry, loading, error }
}
