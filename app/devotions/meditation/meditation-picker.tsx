"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { listMeditationSeries } from "@/lib/meditation-series"

export function MeditationPicker() {
  const all = listMeditationSeries()
  const daily = all.find((s) => s.id === "daily")
  const rest = all.filter((s) => s.id !== "daily")
  const groups = new Map<string, typeof rest>()
  for (const s of rest) {
    const g = s.group ?? "Series"
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(s)
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#030303] text-white overflow-y-auto overflow-x-hidden">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
        aria-hidden
      />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-violet-950/[0.15] via-transparent to-amber-950/[0.08]" aria-hidden />

      <header className="relative z-10 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 min-h-[52px] sm:px-8 border-b border-white/[0.06]">
        <Link
          href="/devotions"
          className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-white/45 hover:text-white/75 transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
          Devotions
        </Link>
        <span className="font-mono text-[10px] tracking-[0.25em] text-white/35 uppercase">Meditation</span>
        <span className="w-[72px]" aria-hidden />
      </header>

      <main className="relative z-10 flex-1 px-4 sm:px-8 md:px-12 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] max-w-3xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-10"
        >
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl font-light text-white/[0.92] tracking-tight">
              Choose a track
            </h1>
            <p className="mt-3 font-sans text-sm text-white/50 font-light leading-relaxed max-w-lg">
              Each series is an ordered set of short passages—sit with one, write freely, then invite prompts. Your place is remembered on this device.
            </p>
          </div>

          {daily && (
            <section>
              <p className="font-mono text-[9px] tracking-[0.35em] text-white/35 uppercase mb-3">Daily</p>
              <Link
                href={`/devotions/meditation/${daily.id}`}
                className="group block rounded-2xl border border-white/12 bg-white/[0.04] px-5 py-5 sm:px-6 sm:py-6 hover:bg-white/[0.07] hover:border-white/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-sans text-lg sm:text-xl font-medium text-white/95">{daily.title}</h2>
                    <p className="mt-2 font-sans text-sm text-white/50 font-light leading-relaxed">{daily.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/50 shrink-0 mt-1 transition-colors" aria-hidden />
                </div>
              </Link>
            </section>
          )}

          {Array.from(groups.entries()).map(([groupName, items]) => (
            <section key={groupName}>
              <p className="font-mono text-[9px] tracking-[0.35em] text-white/35 uppercase mb-3">{groupName}</p>
              <ul className="space-y-2">
                {items.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/devotions/meditation/${s.id}`}
                      className="group flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-4 sm:px-5 hover:bg-white/[0.05] hover:border-white/15 transition-colors min-h-[56px]"
                    >
                      <div className="min-w-0">
                        <h3 className="font-sans text-base sm:text-lg font-light text-white/90 truncate">{s.title}</h3>
                        <p className="font-sans text-xs text-white/45 font-light mt-0.5 line-clamp-2">{s.description}</p>
                        <p className="font-mono text-[10px] text-white/30 mt-2 tabular-nums">
                          {s.passages.length} passage{s.passages.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-white/25 group-hover:text-white/45 shrink-0" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </motion.div>
      </main>
    </div>
  )
}
