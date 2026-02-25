"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { StudyGuideContent } from "./study-guide-content"
import { InlinePassage } from "./inline-passage"

type StudyGuideShellProps = {
  content: string
  defaultPassageRef: string | null
}

const sidebarPassageClasses =
  "font-sans text-base font-light text-white/90 leading-relaxed [&_.text-muted-foreground]:text-white/60 [&_.text-foreground]:text-white [&_.border-border]:border-white/20 [&_.bg-card]:bg-white/5 [&_.text-destructive]:text-red-300 [&_.bg-muted]:bg-white/10 [&_.text-accent]:text-amber-200/90 [&_a]:text-amber-200/90 [&_a:hover]:text-amber-200"

export function StudyGuideShell({ content, defaultPassageRef }: StudyGuideShellProps) {
  const [selectedPassageRef, setSelectedPassageRef] = useState<string | null>(defaultPassageRef)

  const displayRef = selectedPassageRef ?? defaultPassageRef

  return (
    <>
      <div className="px-4 sm:px-8 md:px-12 pb-32 lg:pb-24 max-w-4xl mx-auto lg:max-w-none lg:flex lg:gap-12 lg:pr-[22rem]">
        <main className="min-w-0 flex-1 lg:min-w-0">
          <article className="study-guide study-guide-resonates">
            <StudyGuideContent content={content} onSelectPassage={setSelectedPassageRef} />
          </article>
        </main>

        {/* Sidebar — desktop only */}
        <aside
          className="hidden lg:flex lg:flex-col fixed right-0 top-0 w-[22rem] bottom-0 border-l border-white/10 bg-[#050505] z-30 pt-[var(--navbar-offset)]"
          aria-label="Verses"
          style={{ height: "100dvh" }}
        >
          <div className="shrink-0 px-6 pt-6 pb-2">
            <p className="font-mono text-xs tracking-[0.25em] text-white/50 uppercase">
              Verses
            </p>
          </div>
          <div
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pb-6"
            style={{ WebkitOverflowScrolling: "touch" }}
            data-lenis-prevent
          >
            <AnimatePresence mode="wait">
              {displayRef ? (
                <motion.div
                  key={displayRef}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className={sidebarPassageClasses}
                >
                  <InlinePassage passageRef={displayRef} />
                </motion.div>
              ) : (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="font-sans text-sm text-white/40 italic"
                >
                  Click a verse reference to view the passage.
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </aside>
      </div>

      {/* Mobile: bottom sheet when a verse is selected */}
      <AnimatePresence>
        {selectedPassageRef && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 z-40 bg-black/40"
              onClick={() => setSelectedPassageRef(null)}
            />
            {/* Bottom sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a] border-t border-white/10 rounded-t-2xl max-h-[65vh] flex flex-col"
              data-lenis-prevent
            >
              {/* Drag handle + header */}
              <div className="shrink-0 pt-3 pb-2 px-4">
                <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
                <div className="flex items-center justify-between">
                  <p className="font-mono text-xs tracking-[0.25em] text-white/50 uppercase">
                    Verses
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedPassageRef(null)}
                    className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 active:bg-white/20 transition-colors"
                    aria-label="Close verse panel"
                  >
                    <X className="size-4 text-white/70" />
                  </button>
                </div>
              </div>
              {/* Scrollable content */}
              <div
                className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <div className={sidebarPassageClasses}>
                  <InlinePassage passageRef={selectedPassageRef} />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
