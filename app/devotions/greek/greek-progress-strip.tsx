"use client"

import { motion } from "framer-motion"
import { useCallback, useEffect, useLayoutEffect, useState } from "react"

import {
  getGreekProgressSnapshot,
  getGreekStudyProgress,
  GREEK_PROGRESS_BROADCAST_CHANNEL,
  subscribeGreekXpAwards,
  type GreekProgressSnapshot,
} from "@/lib/devotions-greek-progress"
import { cn } from "@/lib/utils"

type Accent = "emerald" | "amber" | "violet" | "neutral"

const accentBar: Record<Accent, string> = {
  emerald: "from-emerald-400/70 to-cyan-400/60",
  amber: "from-amber-400/70 to-orange-400/50",
  violet: "from-violet-400/65 to-fuchsia-400/55",
  neutral: "from-white/35 to-white/20",
}

export function GreekProgressStrip({
  accent = "emerald",
  className,
  dense = false,
}: {
  accent?: Accent
  className?: string
  /** Tighter padding for menus */
  dense?: boolean
}) {
  const [snap, setSnap] = useState<GreekProgressSnapshot | null>(null)
  const [xpPulse, setXpPulse] = useState(0)

  const refresh = useCallback(() => {
    setSnap(getGreekProgressSnapshot(getGreekStudyProgress()))
  }, [])

  useLayoutEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === "fx_devotions_greek_v1_progress") refresh()
    }
    const onFocus = () => refresh()
    window.addEventListener("storage", onStorage)
    window.addEventListener("focus", onFocus)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("focus", onFocus)
    }
  }, [refresh])

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return
    const ch = new BroadcastChannel(GREEK_PROGRESS_BROADCAST_CHANNEL)
    ch.onmessage = () => refresh()
    return () => ch.close()
  }, [refresh])

  useEffect(() => {
    return subscribeGreekXpAwards(() => setXpPulse((n) => n + 1))
  }, [])

  if (!snap) return null

  const nextLevel = snap.level + 1

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/12 bg-black/30 px-3 py-2.5",
        dense ? "py-2" : "",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
          Level {snap.level}
          <span className="mx-1.5 text-white/25">·</span>
          <span className="text-white/70">{snap.streak} day streak</span>
        </p>
        <p className="font-mono text-[10px] text-white/60">
          <span className="text-white/45">To L{nextLevel}</span>{" "}
          <span className="tabular-nums text-white/75">
            {snap.currentLevelXp}/{snap.nextLevelXp} XP
          </span>
        </p>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          key={xpPulse}
          className={cn("h-full rounded-full bg-gradient-to-r", accentBar[accent])}
          style={{ width: `${snap.levelProgressPct}%` }}
          title={`Progress toward level ${nextLevel}`}
          animate={{ filter: ["brightness(1)", "brightness(1.45)", "brightness(1)"] }}
          transition={{ duration: 0.65, ease: "easeOut" }}
        />
      </div>
      <p className="mt-1.5 font-mono text-[9px] text-white/40">
        Next level {Math.round(snap.levelProgressPct)}% · {snap.uniqueWordForms} word forms tracked
      </p>
    </div>
  )
}

/** Minimal practice chrome: level progress row + bar toward next level. */
export function SlimPracticeBar({
  accent = "emerald",
  className,
}: {
  accent?: Accent
  className?: string
}) {
  const [snap, setSnap] = useState<GreekProgressSnapshot | null>(null)
  const [xpPulse, setXpPulse] = useState(0)

  const refresh = useCallback(() => {
    setSnap(getGreekProgressSnapshot(getGreekStudyProgress()))
  }, [])

  useLayoutEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === "fx_devotions_greek_v1_progress") refresh()
    }
    const onFocus = () => refresh()
    window.addEventListener("storage", onStorage)
    window.addEventListener("focus", onFocus)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("focus", onFocus)
    }
  }, [refresh])

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return
    const ch = new BroadcastChannel(GREEK_PROGRESS_BROADCAST_CHANNEL)
    ch.onmessage = () => refresh()
    return () => ch.close()
  }, [refresh])

  useEffect(() => {
    return subscribeGreekXpAwards(() => setXpPulse((n) => n + 1))
  }, [])

  if (!snap) return null

  const nextLevel = snap.level + 1

  return (
    <div className={cn("border-b border-white/10 bg-black/25 px-3 py-2 sm:px-4", className)}>
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 text-xs text-white/70">
        <span>
          L{snap.level}
          <span className="mx-1.5 text-white/30">·</span>
          {snap.streak}d
        </span>
        <span className="text-right font-mono text-[11px] text-white/60">
          <span className="text-white/45">L{nextLevel}</span>{" "}
          <span className="tabular-nums text-white/80">
            {snap.currentLevelXp}/{snap.nextLevelXp}
          </span>
        </span>
      </div>
      <div className="mx-auto mt-1.5 h-1 max-w-2xl overflow-hidden rounded-full bg-white/10">
        <motion.div
          key={xpPulse}
          className={cn("h-full rounded-full bg-gradient-to-r transition-[width]", accentBar[accent])}
          style={{ width: `${snap.levelProgressPct}%` }}
          title={`Progress toward level ${nextLevel}`}
          animate={{ filter: ["brightness(1)", "brightness(1.5)", "brightness(1)"] }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  )
}
