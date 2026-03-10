"use client"

import { useState, useRef, useCallback } from "react"
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useDragControls,
  type PanInfo,
} from "framer-motion"
import { X, ChevronDown, BookOpen } from "lucide-react"
import { StudyGuideContent, VersePill } from "./study-guide-content"
import { InlinePassage } from "./inline-passage"

type StudyGuideShellProps = {
  content: string
  defaultPassageRef: string | null
  /** Optional title above content (e.g. for devotions topical study) */
  title?: string
  /** Optional description below title */
  description?: string
  /** Optional verse refs to show as pills above content (e.g. bible_references) */
  refs?: string[]
  /** CSS value for sidebar top offset when embedded (e.g. "52px" in devotions). Defaults to var(--navbar-offset). */
  sidebarTopOffset?: string
}

const sidebarPassageClasses =
  "font-sans text-base font-light text-white/90 leading-relaxed [&_.text-muted-foreground]:text-white/60 [&_.text-foreground]:text-white [&_.border-border]:border-white/20 [&_.bg-card]:bg-white/5 [&_.text-destructive]:text-red-300 [&_.bg-muted]:bg-white/10 [&_.text-accent]:text-amber-200/90 [&_a]:text-amber-200/90 [&_a:hover]:text-amber-200"

const DISMISS_THRESHOLD = 60

function MobileBottomSheet({
  passageRef,
  onDismiss,
}: {
  passageRef: string
  onDismiss: () => void
}) {
  const sheetY = useMotionValue(0)
  const backdropOpacity = useTransform(sheetY, [0, 300], [1, 0])
  const dragControls = useDragControls()
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.y > DISMISS_THRESHOLD || info.velocity.y > 300) {
        onDismiss()
      }
    },
    [onDismiss],
  )

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{ opacity: backdropOpacity }}
        className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
        onClick={onDismiss}
      />

      {/* Bottom sheet — draggable via handle */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 350 }}
        style={{ y: sheetY }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0.05, bottom: 0.8 }}
        onDragEnd={handleDragEnd}
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0c0c0c] border-t border-white/10 rounded-t-[20px] max-h-[75vh] flex flex-col shadow-[0_-4px_40px_rgba(0,0,0,0.5)]"
        data-lenis-prevent
      >
        {/* Drag handle area — initiates drag, large touch target */}
        <div
          className="shrink-0 flex flex-col items-center pt-3 pb-2 cursor-grab active:cursor-grabbing select-none"
          style={{ touchAction: "none" }}
          onPointerDown={(e) => dragControls.start(e)}
        >
          <div className="w-14 h-1.5 rounded-full bg-white/30 active:bg-white/50 transition-colors" />
        </div>

        {/* Header — also initiates drag */}
        <div
          className="shrink-0 px-5 pb-3 flex items-center justify-between gap-3 cursor-grab active:cursor-grabbing select-none"
          style={{ touchAction: "none" }}
          onPointerDown={(e) => dragControls.start(e)}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <BookOpen className="size-4 shrink-0 text-amber-200/70" />
            <p className="font-mono text-[11px] tracking-[0.2em] text-amber-200/80 truncate">
              {passageRef}
            </p>
          </div>
          <div
            className="flex items-center gap-2 shrink-0"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onDismiss}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white/8 active:bg-white/15 transition-colors"
              aria-label="Close verse panel"
            >
              <X className="size-3.5 text-white/60" />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-5 h-px bg-white/8" />

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-5 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={passageRef}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className={sidebarPassageClasses}
            >
              <InlinePassage passageRef={passageRef} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Swipe hint at bottom */}
        <div className="shrink-0 flex items-center justify-center gap-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1">
          <ChevronDown className="size-3 text-white/25" />
          <span className="font-mono text-[9px] tracking-widest text-white/25 uppercase">
            Drag down to close
          </span>
        </div>
      </motion.div>
    </>
  )
}

/** Floating indicator pill when a verse is available but the sheet is closed */
function MobileVerseIndicator({
  passageRef,
  onTap,
}: {
  passageRef: string
  onTap: () => void
}) {
  return (
    <motion.button
      initial={{ y: 20, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 20, opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      type="button"
      onClick={onTap}
      className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-[#1a1a1a] border border-white/15 rounded-full pl-3.5 pr-4 py-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.5)] active:scale-95 transition-transform"
    >
      <BookOpen className="size-3.5 text-amber-200/80" />
      <span className="font-mono text-[11px] tracking-wider text-amber-200/90 whitespace-nowrap">
        {passageRef}
      </span>
    </motion.button>
  )
}

export function StudyGuideShell({
  content,
  defaultPassageRef,
  title,
  description,
  refs: refsProp,
  sidebarTopOffset,
}: StudyGuideShellProps) {
  const [selectedPassageRef, setSelectedPassageRef] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const displayRef = selectedPassageRef ?? defaultPassageRef

  const handleSelectPassage = useCallback((ref: string) => {
    setSelectedPassageRef(ref)
    setSheetOpen(true)
  }, [])

  const handleDismiss = useCallback(() => {
    setSheetOpen(false)
  }, [])

  const handleReopen = useCallback(() => {
    setSheetOpen(true)
  }, [])

  const refs = refsProp ?? []

  return (
    <>
      <div className="pb-32 lg:pb-24 lg:flex lg:gap-12 lg:items-start">
        <main className="min-w-0 flex-1 lg:min-w-0">
          {(title ?? description ?? refs.length > 0) && (
            <header className="mb-6 sm:mb-8">
              {title && (
                <h1 className="font-sans text-2xl sm:text-3xl font-light text-white mb-2">
                  {title}
                </h1>
              )}
              {description && (
                <p className="font-sans text-sm text-white/70 mb-4">
                  {description}
                </p>
              )}
              {refs.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {refs.map((ref) => (
                    <VersePill
                      key={ref}
                      passageRef={ref}
                      label={ref}
                      onSelect={handleSelectPassage}
                    />
                  ))}
                </div>
              )}
            </header>
          )}
          <article className="study-guide study-guide-resonates">
            {content?.trim() ? (
              <StudyGuideContent content={content} onSelectPassage={handleSelectPassage} />
            ) : title ? (
              <p className="font-sans text-sm text-white/50 italic">No content for this topic yet.</p>
            ) : (
              <StudyGuideContent content={content} onSelectPassage={handleSelectPassage} />
            )}
          </article>
        </main>

        {/* Sidebar — desktop only; fixed viewport height so inner content scrolls properly */}
        <aside
          className={`hidden lg:flex lg:flex-col lg:sticky lg:w-[22rem] lg:shrink-0 lg:self-start lg:min-h-0 lg:overflow-hidden bg-[#050505] z-10 ${sidebarTopOffset ? "" : "lg:pt-[var(--navbar-offset)]"}`}
          style={{
            ...(sidebarTopOffset ? { paddingTop: sidebarTopOffset } : {}),
            top: sidebarTopOffset ?? "var(--navbar-offset)",
            height: sidebarTopOffset
              ? `calc(100vh - ${sidebarTopOffset})`
              : "calc(100dvh - var(--navbar-offset, 0px))",
            maxHeight: sidebarTopOffset
              ? `calc(100vh - ${sidebarTopOffset})`
              : "calc(100dvh - var(--navbar-offset, 0px))",
          }}
          aria-label="Verses"
        >
          <div className="shrink-0 px-6 pb-2 pt-6">
            <p className="font-mono text-xs tracking-[0.25em] text-white/50 uppercase">
              Verses
            </p>
          </div>
          <div
            className="flex-1 min-h-0 flex flex-col justify-start overflow-y-auto overflow-x-hidden px-6 pb-6 overscroll-contain"
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
                  className={`${sidebarPassageClasses} shrink-0`}
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

      {/* Mobile: draggable bottom sheet */}
      <AnimatePresence>
        {sheetOpen && selectedPassageRef && (
          <MobileBottomSheet
            key={selectedPassageRef}
            passageRef={selectedPassageRef}
            onDismiss={handleDismiss}
          />
        )}
      </AnimatePresence>

      {/* Mobile: floating pill to reopen when sheet is dismissed but a verse is selected */}
      <AnimatePresence>
        {!sheetOpen && selectedPassageRef && (
          <MobileVerseIndicator passageRef={selectedPassageRef} onTap={handleReopen} />
        )}
      </AnimatePresence>
    </>
  )
}
