"use client"

import { motion, AnimatePresence } from "framer-motion"

import { expandGreekMorphToken } from "@/lib/bible/robinson-greek"
import type { GreekMorphToken } from "@/lib/bible/morph-types"

const sidebarClasses =
  "font-sans text-base font-light text-white/90 leading-relaxed [&_.text-muted-foreground]:text-white/60 [&_.text-foreground]:text-white [&_.border-border]:border-white/20"

export function MorphologySidebarPanel({
  token,
  verseNumber,
  wordIndex,
}: {
  token: GreekMorphToken | null
  verseNumber: number
  wordIndex: number
}) {
  const expanded = token ? expandGreekMorphToken(token) : null

  return (
    <AnimatePresence mode="wait">
      {!token && verseNumber > 0 ? (
        <motion.p
          key="missing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="font-sans text-sm text-red-300/85"
        >
          Could not load morphology for this word.
        </motion.p>
      ) : !token ? (
        <motion.p
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="font-sans text-sm text-white/40 italic"
        >
          Open the <span className="text-white/50 not-italic">Learn Greek as you read</span> panel above, then tap
          any word in the Greek line for tenses, moods, participles, and cases.
        </motion.p>
      ) : expanded ? (
        <motion.div
          key={`${verseNumber}-${wordIndex}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className={`space-y-3 text-left ${sidebarClasses}`}
        >
          <div className="border-b border-white/15 pb-2">
            <p className="font-mono text-[10px] tracking-[0.2em] text-amber-200/70 uppercase">
              Greek · verse {verseNumber} · word {wordIndex + 1}
            </p>
            <p className="text-xl font-semibold text-white mt-1" lang="el">
              {token.word}
            </p>
            <p className="text-sm text-white/55 mt-0.5">
              Dictionary form (lemma): <span lang="el">{token.lemma}</span>
            </p>
            <p className="text-[11px] text-white/45 mt-0.5">
              This is the base form you would look up in a Greek lexicon.
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/45">Category</p>
            <p className="text-sm text-white/90">{expanded.posLabel}</p>
          </div>
          <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-amber-200/70 mb-1">Read this first</p>
            <p className="text-sm text-white/92 leading-snug">{expanded.plainEnglishLead}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/45">Morphology tag (MorphGNT)</p>
            <p className="font-mono text-[11px] text-white/55 break-all">{token.parse}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/45">Parsing</p>
            <p className="text-sm text-white/90">{expanded.parseSummary}</p>
          </div>
          {expanded.learningSections.length > 0 && (
            <div className="space-y-3 border-t border-white/10 pt-3">
              <p className="text-[10px] uppercase tracking-wider text-amber-200/60">Mini-lesson</p>
              {expanded.learningSections.map((sec, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-xs font-semibold text-white/95">{sec.title}</p>
                  <p className="text-xs text-white/75 leading-relaxed">{sec.body}</p>
                </div>
              ))}
            </div>
          )}
          {expanded.grammarCards.length > 0 && (
            <div className="space-y-2 border-t border-white/10 pt-3">
              <p className="text-[10px] uppercase tracking-wider text-white/45">Extra notes</p>
              <ul className="list-disc pl-4 space-y-2 text-xs text-white/75 leading-relaxed">
                {expanded.grammarCards.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[9px] leading-snug text-white/35 border-t border-white/10 pt-3">
            Morphology: {/** inline cite */} MorphGNT (CC-BY-SA). Greek text: SBLGNT — see{" "}
            <a href="https://sblgnt.com/license/" className="underline hover:text-white/50" target="_blank" rel="noreferrer">
              SBLGNT license
            </a>
            .
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
