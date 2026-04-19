"use client"

import Link from "next/link"
import { ArrowLeft, Menu } from "lucide-react"

import { SlimPracticeBar } from "@/app/devotions/greek/greek-progress-strip"
import { cn } from "@/lib/utils"

export type PracticeAccent = "emerald" | "amber" | "violet"

const slimBarAccent: Record<PracticeAccent, "emerald" | "amber" | "violet"> = {
  emerald: "emerald",
  amber: "amber",
  violet: "violet",
}

/**
 * Shared full-screen practice chrome: thin header, slim XP row, optional session progress, scrollable body.
 */
export function PracticeLayout({
  title,
  children,
  accent = "emerald",
  onMenu,
  menuLabel = "Menu",
  progressSlot,
  showSlimBar = true,
  homeHref = "/devotions/greek",
}: {
  title: string
  children: React.ReactNode
  accent?: PracticeAccent
  onMenu?: () => void
  menuLabel?: string
  /** e.g. lesson segment bar */
  progressSlot?: React.ReactNode
  showSlimBar?: boolean
  homeHref?: string
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden text-white",
        "bg-[radial-gradient(circle_at_top,#172033,transparent_44%),linear-gradient(to_bottom,#05070f,#030407,#010103)]",
      )}
    >
      <header
        className={cn(
          "relative z-[72] shrink-0 border-b border-white/10 bg-black/35 backdrop-blur-xl",
          "pt-[max(0.5rem,env(safe-area-inset-top))] pb-2",
        )}
      >
        <div className="flex items-center justify-between gap-2 px-3 sm:px-5">
          <Link
            href={homeHref}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-2 text-sm text-white/80 transition-colors hover:bg-white/[0.08] sm:px-3"
          >
            <ArrowLeft className="size-4 opacity-90" aria-hidden />
            <span className="hidden sm:inline">Greek</span>
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-center text-sm font-medium tracking-tight text-white/90 sm:text-base">
            {title}
          </h1>
          {onMenu ? (
            <button
              type="button"
              onClick={onMenu}
              className="inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-2 text-sm text-white/75 hover:bg-white/[0.08] sm:px-3"
              aria-label={menuLabel}
            >
              <Menu className="size-4" aria-hidden />
              <span className="hidden sm:inline">{menuLabel}</span>
            </button>
          ) : (
            <span className="w-10 shrink-0 sm:w-14" aria-hidden />
          )}
        </div>
      </header>
      {showSlimBar ? <SlimPracticeBar accent={slimBarAccent[accent]} /> : null}
      {progressSlot ? (
        <div className="shrink-0 border-b border-white/8 bg-black/20 px-3 py-2 sm:px-5">{progressSlot}</div>
      ) : null}
      <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
    </div>
  )
}
