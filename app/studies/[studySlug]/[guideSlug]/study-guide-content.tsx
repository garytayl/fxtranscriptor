"use client"

import React, { useMemo, useRef } from "react"
import ReactMarkdown from "react-markdown"
import { parsePassageReference, parsePassageList } from "@/lib/bible/reference"
import { InlinePassage } from "./inline-passage"

/** Extract passage refs from markdown in document order (from [text](url) where text parses as ref(s)) */
function extractPassageRefsInOrder(content: string): string[] {
  const refs: string[] = []
  const linkRegex = /\[([^\]]+)\]\((https?:\S+)\)/g
  let match
  while ((match = linkRegex.exec(content)) !== null) {
    const text = match[1].trim()
    const list = text.includes(",") ? parsePassageList(text) : null
    if (list && list.length > 0) {
      list.forEach((p) => refs.push(p.raw))
    } else {
      const single = parsePassageReference(text)
      if (single) refs.push(single.raw)
    }
  }
  return refs
}

function getLinkText(children: React.ReactNode): string {
  if (typeof children === "string") return children.trim()
  if (Array.isArray(children)) return children.map(getLinkText).join("").trim()
  const el = children as React.ReactElement<{ children?: React.ReactNode }> | undefined
  if (el?.props?.children != null) return getLinkText(el.props.children)
  return ""
}

const prose = `
.study-guide.prose h1 { font-size: 1.5rem; font-weight: 600; margin-top: 2rem; margin-bottom: 0.75rem; }
.study-guide.prose h2 { font-size: 1.125rem; font-weight: 600; margin-top: 1.75rem; margin-bottom: 0.5rem; letter-spacing: 0.02em; }
.study-guide.prose h3 { font-size: 1rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.5rem; color: var(--color-muted-foreground); }
.study-guide.prose p { margin-bottom: 0.75rem; line-height: 1.65; white-space: normal; word-spacing: normal; }
.study-guide.prose ul, .study-guide.prose ol { margin-bottom: 1.25rem; padding-left: 1.5rem; }
.study-guide.prose ol { list-style-type: decimal; }
.study-guide.prose ol li { margin-bottom: 0.6rem; padding-left: 0.25rem; line-height: 1.5; }
.study-guide.prose ul li { margin-bottom: 0.35rem; }
/* Indented sub-questions under numbered items: show as a., b., c. */
.study-guide.prose ol li ul { list-style-type: lower-alpha; padding-left: 1.5rem; margin-top: 0.25rem; margin-bottom: 0.5rem; }
.study-guide.prose ol li ul li { margin-bottom: 0.4rem; }
.study-guide.prose li::marker { color: var(--color-accent); font-weight: 600; }
.study-guide.prose a { color: var(--color-accent); text-decoration: underline; }
.study-guide.prose a:hover { text-decoration: none; }
.study-guide.prose strong { font-weight: 600; }
.study-guide.prose em { font-style: italic; }
.study-guide.prose hr { border-color: var(--color-border); margin: 1.5rem 0; }
`

export function StudyGuideContent({ content }: { content: string }) {
  const passageRefsOrdered = useMemo(() => extractPassageRefsInOrder(content), [content])
  const nextVerseIndexRef = useRef(0)

  const linkComponent = ({ href, children }: { href?: string; children?: React.ReactNode }) => {
    const text = getLinkText(children)
    const list = text.includes(",") ? parsePassageList(text) : null
    const refsForThisLink: string[] = list && list.length > 0 ? list.map((p) => p.raw) : []
    const single = !refsForThisLink.length ? parsePassageReference(text) : null
    if (single) refsForThisLink.push(single.raw)

    if (refsForThisLink.length > 0) {
      const startIndex = nextVerseIndexRef.current
      nextVerseIndexRef.current += refsForThisLink.length
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {refsForThisLink.map((ref, i) => (
            <a
              key={`${ref}-${startIndex + i}`}
              href={`#verse-${startIndex + i}`}
              className="inline-flex items-center rounded border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-accent no-underline hover:border-accent hover:bg-accent/20"
            >
              {ref}
            </a>
          ))}
        </span>
      )
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline hover:no-underline">
        {children}
      </a>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: prose }} />
      <div className="study-guide grid w-full min-w-0 grid-cols-1 gap-8 lg:grid-cols-[minmax(20rem,1fr),minmax(0,22rem)]">
        {/* Left column: min 28rem so it never collapses to one-word-per-line; takes remaining space */}
        <div className="min-w-0 font-mono text-sm text-foreground leading-relaxed lg:col-start-1 lg:row-start-1">
          <ReactMarkdown
            components={{
              a: linkComponent,
              h2: ({ children }) => (
                <h2 className="border-b border-border/50 pb-2 font-semibold tracking-wide">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-muted-foreground">{children}</h3>
              ),
              ol: ({ children }) => (
                <ol className="space-y-2 rounded-lg border border-border/30 bg-card/20 px-4 py-3">{children}</ol>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>

        {/* Right column: Bible passages sidebar (sticky); min-w-0 so it can shrink when zoomed */}
        <aside className="min-w-0 border-l border-border/50 bg-background/40 pl-6 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-[var(--navbar-offset)] lg:self-start lg:max-h-[calc(100dvh-var(--navbar-offset)-2rem)] lg:overflow-y-auto">
          <div className="space-y-4 py-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Passages</p>
            {passageRefsOrdered.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground">No passages in this guide.</p>
            ) : (
              passageRefsOrdered.map((ref, i) => (
                <div key={`${ref}-${i}`} id={`verse-${i}`} className="scroll-mt-24">
                  <InlinePassage passageRef={ref} />
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </>
  )
}
