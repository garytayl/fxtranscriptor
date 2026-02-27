"use client"

import { motion, AnimatePresence } from "framer-motion"
import { WordStudyEntryContent } from "@/components/word-study"
import { useLexiconEntry } from "@/app/bible/_components/lexicon-cache-context"

const sidebarEntryClasses =
  "font-sans text-base font-light text-white/90 leading-relaxed [&_.text-muted-foreground]:text-white/60 [&_.text-foreground]:text-white [&_.border-border]:border-white/20 [&_.bg-card]:bg-white/5 [&_.bg-muted]:bg-white/10 [&_.text-accent]:text-amber-200/90"

type WordStudySidebarPanelProps = {
  /** Strong's code to show, e.g. "G26". When null, shows placeholder. */
  code: string | null
  /** When false and code is null, show "Strong's not available for this chapter." */
  hasStrongsForChapter?: boolean
}

export function WordStudySidebarPanel({ code, hasStrongsForChapter = true }: WordStudySidebarPanelProps) {
  const { entry, loading, error } = useLexiconEntry(code)

  return (
    <AnimatePresence mode="wait">
      {!code ? (
        <motion.p
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="font-sans text-sm text-white/40 italic space-y-1"
        >
          {hasStrongsForChapter ? (
            <>
              Click a word in the text to view the Greek or Hebrew definition.
              <span className="block mt-1.5 text-white/30 text-xs not-italic">
                Verse text is shown in KJV so each word matches its Strong’s code.
              </span>
            </>
          ) : (
            "Strong's not available for this chapter."
          )}
        </motion.p>
      ) : loading ? (
        <motion.p
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="font-sans text-sm text-white/50"
        >
          Loading…
        </motion.p>
      ) : error ? (
        <motion.p
          key="error"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="font-sans text-sm text-red-300/90"
        >
          {error}
        </motion.p>
      ) : entry ? (
        <motion.div
          key={code}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className={sidebarEntryClasses}
        >
          <WordStudyEntryContent entry={entry} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
