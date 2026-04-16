"use client"

import { useCallback, useEffect, useLayoutEffect, useState } from "react"

import {
  getGreekProgressSnapshot,
  getGreekStudyProgress,
  type GreekProgressSnapshot,
} from "@/lib/devotions-greek-progress"
import { cn } from "@/lib/utils"

type Accent = "emerald" | "amber" | "neutral"

const accentBar: Record<Accent, string> = {
  emerald: "from-emerald-400/70 to-cyan-400/60",
  amber: "from-amber-400/70 to-orange-400/50",
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

  if (!snap) return null

  const goalPct = Math.min(100, (snap.todayXp / Math.max(1, snap.dailyGoalXp)) * 100)

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
          Today {snap.todayXp}/{snap.dailyGoalXp} XP
          {snap.dailyGoalReached ? (
            <span className="ml-1.5 text-emerald-300/90">Goal met</span>
          ) : null}
        </p>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r", accentBar[accent])}
          style={{ width: `${snap.levelProgressPct}%` }}
          title="Progress toward next level"
        />
      </div>
      <p className="mt-1.5 font-mono text-[9px] text-white/40">
        Daily goal bar: {Math.round(goalPct)}% · {snap.uniqueWordForms} word forms tracked
      </p>
    </div>
  )
}
