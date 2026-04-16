"use client"

import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, Library } from "lucide-react"

import { GreekWordBankPanel } from "@/app/devotions/greek/greek-word-bank-panel"

type Accent = "emerald" | "amber"

export function GreekWordBankOverlay({
  open,
  onClose,
  accent,
}: {
  open: boolean
  onClose: () => void
  accent: Accent
}) {
  const borderAccent =
    accent === "emerald" ? "border-emerald-400/25 text-emerald-200/90" : "border-amber-400/25 text-amber-200/90"

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 z-[85] flex flex-col bg-[#03060c]/95 backdrop-blur-lg"
          role="dialog"
          aria-label="Words you are learning"
        >
          <header className="shrink-0 border-b border-white/10 px-4 py-3 sm:px-5">
            <div className="mx-auto flex max-w-xl items-center justify-between gap-3 sm:max-w-2xl">
              <button
                type="button"
                onClick={onClose}
                className={`-ml-1 inline-flex min-h-[40px] items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/75 transition-colors hover:bg-white/[0.1]`}
              >
                <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
                Back
              </button>
              <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] ${borderAccent}`}>
                  <Library className="size-3.5 shrink-0 opacity-90" aria-hidden />
                  Word bank
                </span>
                <span className="mt-0.5 truncate text-xs text-white/55">Forms from Verse Quest practice</span>
              </div>
              <span className="w-[4.5rem] shrink-0 sm:w-24" aria-hidden />
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
            <div className="mx-auto max-w-xl sm:max-w-2xl">
              <GreekWordBankPanel accent={accent} />
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
