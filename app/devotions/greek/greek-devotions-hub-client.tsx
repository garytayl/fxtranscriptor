"use client"

import Link from "next/link"
import { ArrowLeft, BookOpen, Gamepad2, GraduationCap, Library, Sparkles } from "lucide-react"

import { GreekProgressStrip } from "@/app/devotions/greek/greek-progress-strip"
import { GreekSectionQuickNav } from "@/app/devotions/greek/greek-section-quick-nav"

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

export function GreekDevotionsHubClient() {
  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,#172033,transparent_44%),linear-gradient(to_bottom,#05070f,#030407,#010103)] text-white">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
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

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <GreekProgressStrip accent="emerald" className="mb-6" />

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
                  className={`flex min-h-[120px] flex-col gap-2 rounded-2xl border p-4 transition-colors ${tile.className}`}
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
      </main>
    </div>
  )
}
