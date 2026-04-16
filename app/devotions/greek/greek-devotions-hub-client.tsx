"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  BookOpen,
  Gamepad2,
  GraduationCap,
  Library,
  MapPin,
  Sparkles,
  Target,
} from "lucide-react"

import { MORPH_PILOT_CHAPTERS } from "@/lib/bible/morph-pilot-menu"
import {
  activeDaysInRollingWindow,
  pilotVerseTotalCount,
  rollingDailyXpSum,
  uniqueQuestCompletedVersesCount,
} from "@/lib/devotions-greek-hub-stats"
import { getNextMilestone } from "@/lib/devotions-greek-milestones"
import {
  getGreekProgressSnapshot,
  getGreekStudyProgress,
  GREEK_PROGRESS_BROADCAST_CHANNEL,
  type GreekProgressSnapshot,
} from "@/lib/devotions-greek-progress"
import { loadGreekPilotPlace, type StoredPlace } from "@/app/devotions/greek/greek-pilot-verse-shared"
import { GreekProgressStrip } from "@/app/devotions/greek/greek-progress-strip"
import { GreekSectionQuickNav } from "@/app/devotions/greek/greek-section-quick-nav"
import { GreekHubBackupPanel } from "@/app/devotions/greek/greek-hub-backup-panel"
import { cn } from "@/lib/utils"

const TILES: {
  href: string
  title: string
  blurb: string
  icon: typeof GraduationCap
  className: string
}[] = [
  {
    href: "/devotions/greek/endings",
    title: "Endings Lab",
    blurb: "Memorize noun, verb, and article endings before you read.",
    icon: GraduationCap,
    className:
      "border-emerald-400/35 bg-emerald-500/10 hover:bg-emerald-500/18 text-emerald-100",
  },
  {
    href: "/devotions/greek/reader",
    title: "Grammar Reader",
    blurb: "Pilot NT verses: tap any word for morphology and Strong’s—no quizzes.",
    icon: BookOpen,
    className: "border-amber-400/35 bg-amber-500/10 hover:bg-amber-500/18 text-amber-100",
  },
  {
    href: "/devotions/greek/quest",
    title: "Verse Quest",
    blurb: "Guided drills, XP, and word memory on the same passages.",
    icon: Gamepad2,
    className:
      "border-cyan-400/35 bg-cyan-500/10 hover:bg-cyan-500/16 text-cyan-100",
  },
  {
    href: "/devotions/greek/words",
    title: "Word bank",
    blurb: "Every form you have practiced—filter, search, and review.",
    icon: Library,
    className: "border-white/18 bg-white/[0.05] hover:bg-white/[0.1] text-white/90",
  },
]

function placeLabel(place: StoredPlace): string {
  const row = MORPH_PILOT_CHAPTERS.find((c) => c.bookSlug === place.bookSlug && c.chapter === place.chapter)
  const book = row?.bookName ?? place.bookSlug
  return `${book} ${place.chapter}:${place.verse}`
}

export function GreekDevotionsHubClient() {
  const [snap, setSnap] = useState<GreekProgressSnapshot | null>(null)
  const [place, setPlace] = useState<StoredPlace | null>(null)
  const [pilotTotal, setPilotTotal] = useState(0)
  const [questVerses, setQuestVerses] = useState(0)
  const [weeklyXp, setWeeklyXp] = useState(0)
  const [activeWeekDays, setActiveWeekDays] = useState(0)

  const refresh = useCallback(() => {
    const prog = getGreekStudyProgress()
    setSnap(getGreekProgressSnapshot(prog))
    setPlace(loadGreekPilotPlace())
    setPilotTotal(pilotVerseTotalCount())
    setQuestVerses(uniqueQuestCompletedVersesCount(prog))
    setWeeklyXp(rollingDailyXpSum(prog, 7))
    setActiveWeekDays(activeDaysInRollingWindow(prog, 7))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === "fx_devotions_greek_v1_progress" || e.key === "fx_devotions_greek_place_v1") refresh()
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

  const milestone = useMemo(() => {
    if (!snap) return null
    const prog = getGreekStudyProgress()
    return getNextMilestone({
      progress: prog,
      snapshot: snap,
      questVersesCompleted: questVerses,
      pilotVerseTotal: pilotTotal || 1,
    })
  }, [snap, questVerses, pilotTotal])

  const showOnboarding = snap !== null && snap.uniqueWordForms === 0

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,#172033,transparent_44%),linear-gradient(to_bottom,#05070f,#030407,#010103)] text-white">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/devotions"
            className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/75 hover:bg-white/[0.1]"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Devotions
          </Link>
          <div className="min-w-0 text-center">
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-200/85">
              <Sparkles className="size-3.5" aria-hidden />
              Greek study
            </span>
            <p className="text-xs text-white/50">Labs, reader, quest</p>
          </div>
          <span className="w-14 sm:w-20" aria-hidden />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <GreekProgressStrip accent="emerald" className="mb-4" />

        {snap && milestone ? (
          <section
            className="mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-950/20 px-4 py-3 sm:px-5"
            aria-label="Next milestone"
          >
            <div className="flex items-start gap-2">
              <Target className="mt-0.5 size-4 shrink-0 text-emerald-300/90" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-200/80">Next milestone</p>
                <p className="mt-1 text-sm font-medium text-white/95">{milestone.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-white/65">{milestone.detail}</p>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400/80 to-cyan-400/70"
                    style={{ width: `${milestone.progressPct}%` }}
                  />
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {showOnboarding ? (
          <section className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-950/25 px-4 py-3 sm:px-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-200/85">Welcome</p>
            <p className="mt-1.5 text-sm leading-relaxed text-white/85">
              Start with <strong className="text-white/95">Endings Lab</strong>, explore the{" "}
              <strong className="text-white/95">Grammar Reader</strong>, then earn XP in{" "}
              <strong className="text-white/95">Verse Quest</strong>—your word bank fills as you practice.
            </p>
          </section>
        ) : null}

        {place ? (
          <section className="mb-4 rounded-2xl border border-white/12 bg-black/30 px-4 py-3 sm:px-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">Continue</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm text-white/90">
                <MapPin className="size-3.5 text-cyan-300/80" aria-hidden />
                {placeLabel(place)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/devotions/greek/reader"
                className="inline-flex items-center gap-2 rounded-xl border border-amber-400/35 bg-amber-500/12 px-3 py-2 text-xs font-medium text-amber-50 transition-colors hover:bg-amber-500/20"
              >
                <BookOpen className="size-3.5" aria-hidden />
                Reader
              </Link>
              <Link
                href="/devotions/greek/quest"
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/35 bg-cyan-500/12 px-3 py-2 text-xs font-medium text-cyan-50 transition-colors hover:bg-cyan-500/20"
              >
                <Gamepad2 className="size-3.5" aria-hidden />
                Quest
              </Link>
            </div>
          </section>
        ) : null}

        {snap ? (
          <section className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">Last 7 days XP</p>
              <p className="mt-1 font-mono text-lg text-white/95">{weeklyXp}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">Pilot verses (quest)</p>
              <p className="mt-1 font-mono text-lg text-white/95">
                {questVerses}
                <span className="text-white/40"> / {pilotTotal}</span>
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">Active days (7d)</p>
              <p className="mt-1 font-mono text-lg text-white/95">{activeWeekDays}</p>
            </div>
          </section>
        ) : null}

        <section className="mb-8 rounded-2xl border border-white/10 bg-black/25 px-4 py-4 sm:px-5">
          <p className="text-sm leading-relaxed text-white/82">
            <strong className="font-medium text-white/95">Suggested path:</strong> Endings Lab builds pattern
            recognition, Grammar Reader lets you explore verses freely, Verse Quest adds drills and XP, and the Word bank
            collects everything you have touched in the quest.
          </p>
          <div className="mt-4">
            <GreekSectionQuickNav />
          </div>
        </section>

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TILES.map((tile) => {
            const Icon = tile.icon
            return (
              <li key={tile.href}>
                <Link
                  href={tile.href}
                  className={cn(
                    "flex min-h-[120px] flex-col gap-2 rounded-2xl border p-4 transition-colors",
                    tile.className,
                  )}
                >
                  <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] opacity-95">
                    <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
                    {tile.title}
                  </span>
                  <span className="text-sm font-light leading-snug text-white/85">{tile.blurb}</span>
                </Link>
              </li>
            )
          })}
        </ul>

        <GreekHubBackupPanel className="mt-10" onBackupApplied={refresh} />
      </main>
    </div>
  )
}
