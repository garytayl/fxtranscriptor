"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

import { WordStudyEntryContent } from "@/components/word-study"
import { strongsCodeForGreekLemma } from "@/lib/bible/greek-lemma-english-quiz"
import { expandGreekMorphToken } from "@/lib/bible/robinson-greek"
import type { GreekMorphToken } from "@/lib/bible/morph-types"
import type { StrongsEntry } from "@/lib/bible/lexicon"

const sidebarClasses =
  "font-sans text-base font-light text-white/90 leading-relaxed [&_.text-muted-foreground]:text-white/60 [&_.text-foreground]:text-white [&_.border-border]:border-white/20"

/** Fetches and renders full Strong's text in-panel (no hover). */
function InlineStrongsLexicon({ code, surfaceWord }: { code: string; surfaceWord: string }) {
  const [entry, setEntry] = useState<StrongsEntry | null>(null)
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    let cancelled = false
    setPhase("loading")
    setEntry(null)
    fetch(`/api/bible/lexicon/${encodeURIComponent(code)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: StrongsEntry | null) => {
        if (cancelled) return
        if (data) {
          setEntry(data)
          setPhase("ready")
        } else {
          setPhase("error")
        }
      })
      .catch(() => {
        if (!cancelled) setPhase("error")
      })
    return () => {
      cancelled = true
    }
  }, [code])

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-lg font-semibold text-amber-100/95" lang="el">
          {surfaceWord}
        </span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-amber-200/80">
          {code}
        </span>
      </div>
      {phase === "loading" ? (
        <p className="text-xs text-white/50">Loading Strong&apos;s…</p>
      ) : phase === "error" || !entry ? (
        <p className="text-xs text-white/55">Could not load this Strong&apos;s entry.</p>
      ) : (
        <div className="border-t border-white/15 pt-2 [&_.text-muted-foreground]:text-white/60 [&_.text-foreground]:text-white/92 [&_.border-border]:border-white/20">
          <WordStudyEntryContent entry={entry} hideTitleRow />
        </div>
      )}
    </div>
  )
}

export function MorphologySidebarPanel({
  token,
  verseNumber,
  wordIndex,
  wordBank = false,
}: {
  token: GreekMorphToken | null
  verseNumber: number
  wordIndex: number
  /** When true, header copy is for saved word-bank forms (no verse context). */
  wordBank?: boolean
}) {
  const expanded = token ? expandGreekMorphToken(token) : null
  const lemmaStrongsCode = token ? strongsCodeForGreekLemma(token.lemma) : null

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
          key={wordBank ? `bank-${token.lemma}|${token.parse}` : `${verseNumber}-${wordIndex}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className={`space-y-3 text-left ${sidebarClasses}`}
        >
          <div className="border-b border-white/15 pb-2">
            <p className="font-mono text-[10px] tracking-[0.2em] text-amber-200/70 uppercase">
              {wordBank
                ? "Greek · word bank · Strong's & grammar"
                : `Greek · verse ${verseNumber} · word ${wordIndex + 1}`}
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
          <div className="rounded-md border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-amber-200/75">Strong&apos;s · this word</p>
            {lemmaStrongsCode ? (
              <InlineStrongsLexicon code={lemmaStrongsCode} surfaceWord={token.word} />
            ) : (
              <p className="text-xs text-white/55 leading-snug">
                No Strong&apos;s lexicon link for this dictionary form ({token.lemma}) in our lemma index.
              </p>
            )}
            <p className="text-[10px] leading-snug text-white/45">
              Lexicon is matched from this word&apos;s dictionary form (lemma), not from KJV word order in this verse.
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
