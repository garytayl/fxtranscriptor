import Link from "next/link"
import { ArrowLeft, Sparkles } from "lucide-react"

import { GreekStudyCoachClient } from "@/app/devotions/greek/greek-study-coach-client"
import { GreekSectionQuickNav } from "@/app/devotions/greek/greek-section-quick-nav"

export const metadata = {
  title: "Greek study coach",
  description:
    "Ask the AI coach about your Greek study path—personalized using your XP, streak, weak words, and milestones on this device.",
}

export default function GreekStudyCoachPage() {
  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,#172033,transparent_44%),linear-gradient(to_bottom,#05070f,#030407,#010103)] text-white">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/devotions/greek"
            className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/75 hover:bg-white/[0.1]"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Greek
          </Link>
          <div className="flex min-w-0 flex-col items-center text-center">
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-200/85">
              <Sparkles className="size-3.5" aria-hidden />
              Study coach
            </span>
            <span className="text-xs text-white/50">Your progress · your questions</span>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <Link
              href="/devotions/greek/lesson"
              className="rounded-full border border-violet-400/35 bg-violet-500/12 px-2.5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-violet-100 hover:bg-violet-500/20 sm:px-3"
            >
              Lesson
            </Link>
            <Link
              href="/devotions/greek/quest"
              className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-200/90 hover:bg-emerald-500/18 sm:px-3"
            >
              Quest
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <GreekSectionQuickNav className="mb-5" activeVariant="emerald" />
        <GreekStudyCoachClient />
      </main>
    </div>
  )
}
