"use client"

import React from "react"
import ReactMarkdown from "react-markdown"
import { parsePassageReference, parsePassageList } from "@/lib/bible/reference"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { InlinePassage } from "./inline-passage"

function getLinkText(children: React.ReactNode): string {
  if (typeof children === "string") return children.trim()
  if (Array.isArray(children)) return children.map(getLinkText).join("").trim()
  const el = children as React.ReactElement<{ children?: React.ReactNode }> | undefined
  if (el?.props?.children != null) return getLinkText(el.props.children)
  return ""
}

/** Resonates-style prose: single column, font-sans body, border-white/15, amber accent */
const prose = `
.study-guide-resonates.study-guide.prose h1 { font-size: 1.25rem; font-weight: 600; margin-top: 1.75rem; margin-bottom: 0.625rem; color: white; }
.study-guide-resonates.study-guide.prose h2 { font-size: 1.0625rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.02em; color: white; border-color: rgba(255,255,255,0.15); }
.study-guide-resonates.study-guide.prose h3 { font-size: 0.9375rem; font-weight: 600; margin-top: 1.125rem; margin-bottom: 0.5rem; color: rgba(255,255,255,0.7); }
.study-guide-resonates.study-guide.prose p { margin-bottom: 0.75rem; line-height: 1.7; color: rgba(255,255,255,0.9); white-space: normal; word-spacing: normal; }
.study-guide-resonates.study-guide.prose ul, .study-guide-resonates.study-guide.prose ol { margin-bottom: 1.25rem; }
/* Numbered list: force decimal markers */
.study-guide-resonates.study-guide.prose ol { list-style-type: decimal; list-style-position: outside; padding-left: 1.5rem; margin-left: 0; }
/* Each numbered item = one question block */
.study-guide-resonates.study-guide.prose ol li { margin-bottom: 1rem; padding: 0.625rem 0 0.375rem 0.5rem; margin-left: 0; line-height: 1.65; border-left: 2px solid rgba(251,191,36,0.25); background: rgba(255,255,255,0.03); border-radius: 0 6px 6px 0; }
.study-guide-resonates.study-guide.prose ol li:last-child { margin-bottom: 0; }
.study-guide-resonates.study-guide.prose ol li > p:first-of-type { color: white; font-weight: 600; font-size: 0.9375rem; margin-bottom: 0.5rem; }
.study-guide-resonates.study-guide.prose ol li > p:not(:first-of-type) { color: rgba(255,255,255,0.85); font-weight: 400; margin-bottom: 0.5rem; }
.study-guide-resonates.study-guide.prose ol li:not(:has(> p)) { color: white; font-weight: 600; }
.study-guide-resonates.study-guide.prose ul li { margin-bottom: 0.35rem; }
.study-guide-resonates.study-guide.prose ol li ul { list-style-type: lower-alpha; list-style-position: outside; padding-left: 1.5rem; margin-top: 0.35rem; margin-bottom: 0.5rem; margin-left: 0; }
.study-guide-resonates.study-guide.prose ol li ul li { margin-bottom: 0.4rem; margin-left: 0; color: rgba(255,255,255,0.9); padding-left: 0.25rem; }
.study-guide-resonates.study-guide.prose ol li ul li > p { font-weight: 500; color: rgba(255,255,255,0.95); }
.study-guide-resonates.study-guide.prose li::marker { color: rgba(251,191,36,0.9); font-weight: 700; }
.study-guide-resonates.study-guide.prose a { color: rgba(251,191,36,0.9); text-decoration: underline; }
.study-guide-resonates.study-guide.prose a:hover { text-decoration: none; color: rgb(253,224,71); }
.study-guide-resonates.study-guide.prose strong { font-weight: 600; }
.study-guide-resonates.study-guide.prose em { font-style: italic; }
.study-guide-resonates.study-guide.prose hr { border-color: rgba(255,255,255,0.15); margin: 1.25rem 0; }
/* Desktop: larger type and spacing */
@media (min-width: 640px) {
  .study-guide-resonates.study-guide.prose h1 { font-size: 1.5rem; margin-top: 2rem; margin-bottom: 0.75rem; }
  .study-guide-resonates.study-guide.prose h2 { font-size: 1.125rem; margin-top: 1.75rem; }
  .study-guide-resonates.study-guide.prose h3 { font-size: 1rem; margin-top: 1.25rem; }
  .study-guide-resonates.study-guide.prose ol { padding-left: 2.25rem; }
  .study-guide-resonates.study-guide.prose ol li { margin-bottom: 1.25rem; padding: 0.75rem 0 0.5rem 0.5rem; }
  .study-guide-resonates.study-guide.prose ol li > p:first-of-type { font-size: 1rem; }
  .study-guide-resonates.study-guide.prose ol li ul { padding-left: 2rem; }
  .study-guide-resonates.study-guide.prose hr { margin: 1.5rem 0; }
}
`

/** Verse ref pill: hover = preview in HoverCard (desktop), tap = open bottom sheet (mobile) */
function VersePill({
  passageRef,
  label,
  onSelect,
}: {
  passageRef: string
  label: string
  onSelect: (ref: string) => void
}) {
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={() => onSelect(passageRef)}
          className="cursor-pointer inline-flex items-center gap-1 border border-amber-500/30 bg-amber-500/5 active:bg-amber-500/15 pl-2 pr-2.5 py-1 rounded-md font-mono text-[10px] sm:text-[11px] uppercase tracking-wider text-amber-200/90 hover:text-amber-200 hover:border-amber-500/50 hover:bg-amber-500/10 text-left transition-colors min-h-[36px] sm:min-h-0 active:scale-[0.97]"
        >
          <span className="w-1 h-3.5 rounded-full bg-amber-500/60 shrink-0" />
          {label}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        side="right"
        sideOffset={8}
        className="hidden lg:block w-[min(24rem,calc(100vw-2rem))] max-h-[min(70vh,28rem)] overflow-y-auto border-white/10 bg-[#0a0a0a] text-white shadow-xl p-0 [&_a]:text-amber-200/90 [&_a:hover]:text-amber-200 [&_.text-muted-foreground]:text-white/60 [&_.text-foreground]:text-white [&_.border-border]:border-white/20 [&_.bg-card]:bg-white/5 [&_.text-destructive]:text-red-300 [&_.bg-muted]:bg-white/10 [&_.text-accent]:text-amber-200/90"
      >
        <div className="p-4">
          <InlinePassage passageRef={passageRef} />
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

export function StudyGuideContent({
  content,
  onSelectPassage,
}: {
  content: string
  onSelectPassage?: (ref: string) => void
}) {
  const linkComponent = ({ href, children }: { href?: string; children?: React.ReactNode }) => {
    const text = getLinkText(children)
    const list = text.includes(",") ? parsePassageList(text) : null
    const refsForThisLink: string[] = list && list.length > 0 ? list.map((p) => p.raw) : []
    const single = !refsForThisLink.length ? parsePassageReference(text) : null
    if (single) refsForThisLink.push(single.raw)

    if (refsForThisLink.length > 0 && onSelectPassage) {
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {refsForThisLink.map((ref, i) => (
            <VersePill key={`${ref}-${i}`} passageRef={ref} label={ref} onSelect={onSelectPassage} />
          ))}
        </span>
      )
    }
    if (refsForThisLink.length > 0) {
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-amber-200/90">
          {refsForThisLink.map((ref, i) => (
            <span key={`${ref}-${i}`}>{ref}</span>
          ))}
        </span>
      )
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-amber-200/90 hover:text-amber-200 underline underline-offset-2">
        {children}
      </a>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: prose }} />
      <div className="study-guide prose font-sans text-[0.9375rem] sm:text-base font-light leading-relaxed">
        <ReactMarkdown
          components={{
            a: linkComponent,
            h2: ({ children }) => (
              <h2 className="border-b border-white/15 pb-2 font-semibold tracking-wide">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-white/70">{children}</h3>
            ),
            ol: ({ children }) => (
              <ol className="space-y-0 border-l border-white/15 pl-5 sm:pl-8 py-2 mt-3 sm:mt-4 mb-5 sm:mb-6 list-decimal list-outside">{children}</ol>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </>
  )
}
