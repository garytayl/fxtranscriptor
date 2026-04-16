import Link from "next/link"
import { ArrowLeft, Library } from "lucide-react"

import { GreekSectionQuickNav } from "@/app/devotions/greek/greek-section-quick-nav"
import { GreekWordBankPanel } from "@/app/devotions/greek/greek-word-bank-panel"

export const metadata = {
  title: "Greek word bank",
  description: "Every word form you have practiced in Verse Quest—familiarity, quiz stats, and review weight.",
}

export default function GreekWordsPage() {
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
              <Library className="size-3.5" aria-hidden />
              Word bank
            </span>
            <span className="text-xs text-white/50">Verse Quest vocabulary</span>
          </div>
          <Link
            href="/devotions/greek/quest"
            className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-200/90 hover:bg-emerald-500/18"
          >
            Quest
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <GreekSectionQuickNav className="mb-5" />
        <GreekWordBankPanel accent="emerald" />
      </main>
    </div>
  )
}
