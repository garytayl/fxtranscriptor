"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Sparkles, X } from "lucide-react"
import type { ReactNode, TouchEvent } from "react"

import { cn } from "@/lib/utils"

type Accent = "emerald" | "amber" | "violet"

const accentTitle: Record<Accent, string> = {
  emerald: "text-emerald-200/90",
  amber: "text-amber-200/90",
  violet: "text-violet-200/90",
}

type GreekStudyMenuShellProps = {
  open: boolean
  onClose: () => void
  title: string
  accent: Accent
  children: ReactNode
  onMenuTouchStart?: (e: TouchEvent<HTMLDivElement>) => void
  onMenuTouchMove?: (e: TouchEvent<HTMLDivElement>) => void
  onMenuTouchEnd?: (e: TouchEvent<HTMLDivElement>) => void
}

/**
 * Full-screen dim + scrollable card for Greek study controls (verse rolodex, links, prefs).
 * Uses absolute positioning so it stays inside immersive Greek clients (fixed full-screen root).
 */
export function GreekStudyMenuShell({
  open,
  onClose,
  title,
  accent,
  children,
  onMenuTouchStart,
  onMenuTouchMove,
  onMenuTouchEnd,
}: GreekStudyMenuShellProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 z-[78] flex flex-col justify-end bg-black/70 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(3.25rem,calc(env(safe-area-inset-top)+2.75rem))] backdrop-blur-md sm:items-center sm:justify-center sm:px-6 sm:pb-10 sm:pt-10"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="mx-auto flex max-h-[min(88dvh,820px)] w-full max-w-lg flex-col overflow-hidden rounded-[1.25rem] border border-white/16 bg-[#060a14]/[0.98] shadow-[0_28px_90px_-24px_rgba(0,0,0,0.9)] sm:max-w-xl sm:rounded-3xl"
            role="dialog"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onMenuTouchStart}
            onTouchMove={onMenuTouchMove}
            onTouchEnd={onMenuTouchEnd}
          >
            <div className="shrink-0 border-b border-white/10 px-4 py-3.5 sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <p
                  className={cn(
                    "inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em]",
                    accentTitle[accent],
                  )}
                >
                  <Sparkles className="size-3.5 shrink-0 opacity-90" aria-hidden />
                  {title}
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/18 bg-white/[0.06] text-white/80 transition-colors hover:bg-white/[0.12]"
                  aria-label="Close menu"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-5 sm:py-5">
              {children}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export function GreekMenuSection({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("space-y-2.5", className)}>
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{label}</p>
      {children}
    </section>
  )
}
