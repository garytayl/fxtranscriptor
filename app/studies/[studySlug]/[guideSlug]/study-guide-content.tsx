"use client"

import React, { useRef } from "react"
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
.study-guide-resonates.study-guide.prose h1 { font-size: 1.5rem; font-weight: 600; margin-top: 2rem; margin-bottom: 0.75rem; color: white; }
.study-guide-resonates.study-guide.prose h2 { font-size: 1.125rem; font-weight: 600; margin-top: 1.75rem; margin-bottom: 0.5rem; letter-spacing: 0.02em; color: white; border-color: rgba(255,255,255,0.15); }
.study-guide-resonates.study-guide.prose h3 { font-size: 1rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.5rem; color: rgba(255,255,255,0.7); }
.study-guide-resonates.study-guide.prose p { margin-bottom: 0.75rem; line-height: 1.65; color: rgba(255,255,255,0.9); white-space: normal; word-spacing: normal; }
.study-guide-resonates.study-guide.prose ul, .study-guide-resonates.study-guide.prose ol { margin-bottom: 1.25rem; padding-left: 1.5rem; }
.study-guide-resonates.study-guide.prose ol { list-style-type: decimal; }
/* Each numbered item = one question block: padding, border, extra spacing */
.study-guide-resonates.study-guide.prose ol li { margin-bottom: 1.25rem; padding: 0.75rem 0 0.5rem 0.75rem; line-height: 1.6; border-left: 2px solid rgba(251,191,36,0.25); background: rgba(255,255,255,0.03); border-radius: 0 6px 6px 0; }
.study-guide-resonates.study-guide.prose ol li:last-child { margin-bottom: 0; }
/* First paragraph in each item = the question: bolder, brighter, easier to scan */
.study-guide-resonates.study-guide.prose ol li > p:first-of-type { color: white; font-weight: 600; font-size: 1rem; margin-bottom: 0.5rem; }
.study-guide-resonates.study-guide.prose ol li > p:not(:first-of-type) { color: rgba(255,255,255,0.85); font-weight: 400; margin-bottom: 0.5rem; }
/* Single-line list items (no inner p): treat whole line as question */
.study-guide-resonates.study-guide.prose ol li:not(:has(> p)) { color: white; font-weight: 600; }
.study-guide-resonates.study-guide.prose ul li { margin-bottom: 0.35rem; }
.study-guide-resonates.study-guide.prose ol li ul { list-style-type: lower-alpha; padding-left: 1.5rem; margin-top: 0.35rem; margin-bottom: 0.5rem; }
.study-guide-resonates.study-guide.prose ol li ul li { margin-bottom: 0.4rem; color: rgba(255,255,255,0.9); }
/* Sub-questions (a. b. c.) slightly bolder so they read as questions too */
.study-guide-resonates.study-guide.prose ol li ul li > p { font-weight: 500; color: rgba(255,255,255,0.95); }
.study-guide-resonates.study-guide.prose li::marker { color: rgba(251,191,36,0.9); font-weight: 700; }
.study-guide-resonates.study-guide.prose a { color: rgba(251,191,36,0.9); text-decoration: underline; }
.study-guide-resonates.study-guide.prose a:hover { text-decoration: none; color: rgb(253,224,71); }
.study-guide-resonates.study-guide.prose strong { font-weight: 600; }
.study-guide-resonates.study-guide.prose em { font-style: italic; }
.study-guide-resonates.study-guide.prose hr { border-color: rgba(255,255,255,0.15); margin: 1.5rem 0; }
`

/** Verse ref pill that shows passage in a HoverCard on hover only (no sidebar) */
function PassageHoverCard({ passageRef, label }: { passageRef: string; label: string }) {
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              ;(e.currentTarget as HTMLElement).click()
            }
          }}
          className="cursor-pointer border-l-2 border-amber-500/50 pl-1.5 -ml-1.5 pr-1 rounded hover:bg-white/10 font-mono text-[11px] uppercase tracking-wider text-amber-200/90 hover:text-amber-200 inline"
        >
          {label}
        </span>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        side="right"
        sideOffset={8}
        className="w-[min(24rem,calc(100vw-2rem))] max-h-[min(70vh,28rem)] overflow-y-auto border-white/10 bg-[#0a0a0a] text-white shadow-xl p-0 [&_a]:text-amber-200/90 [&_a:hover]:text-amber-200 [&_.text-muted-foreground]:text-white/60 [&_.text-foreground]:text-white [&_.border-border]:border-white/20 [&_.bg-card]:bg-white/5 [&_.text-destructive]:text-red-300 [&_.bg-muted]:bg-white/10 [&_.text-accent]:text-amber-200/90"
      >
        <div className="p-4">
          <InlinePassage passageRef={passageRef} />
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

export function StudyGuideContent({ content }: { content: string }) {
  const nextVerseIndexRef = useRef(0)

  const linkComponent = ({ href, children }: { href?: string; children?: React.ReactNode }) => {
    const text = getLinkText(children)
    const list = text.includes(",") ? parsePassageList(text) : null
    const refsForThisLink: string[] = list && list.length > 0 ? list.map((p) => p.raw) : []
    const single = !refsForThisLink.length ? parsePassageReference(text) : null
    if (single) refsForThisLink.push(single.raw)

    if (refsForThisLink.length > 0) {
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {refsForThisLink.map((ref, i) => (
            <PassageHoverCard key={`${ref}-${i}`} passageRef={ref} label={ref} />
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
      <div className="study-guide prose font-sans text-base font-light leading-relaxed">
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
              <ol className="space-y-0 border-l border-white/15 pl-4 sm:pl-5 py-1">{children}</ol>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </>
  )
}
