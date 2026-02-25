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
.study-guide.prose h1 { font-size: 1.75rem; font-weight: 600; margin-top: 2rem; margin-bottom: 0.75rem; line-height: 1.3; }
.study-guide.prose h2 { font-size: 1.25rem; font-weight: 600; margin-top: 2rem; margin-bottom: 0.75rem; letter-spacing: 0.02em; line-height: 1.35; color: var(--color-foreground); }
.study-guide.prose h3 { font-size: 1.0625rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.5rem; color: var(--color-muted-foreground); line-height: 1.4; }
.study-guide.prose p { margin-bottom: 1rem; line-height: 1.75; font-size: 1rem; }
.study-guide.prose ul, .study-guide.prose ol { margin-bottom: 1.5rem; padding-left: 1.5rem; }
.study-guide.prose ol { list-style-type: decimal; }
.study-guide.prose ol li { margin-bottom: 0.875rem; padding-left: 0.375rem; line-height: 1.65; font-size: 1rem; }
.study-guide.prose ul li { margin-bottom: 0.5rem; line-height: 1.6; font-size: 1rem; }
.study-guide.prose li::marker { color: var(--color-accent); font-weight: 600; }
.study-guide.prose a { color: var(--color-accent); text-decoration: underline; }
.study-guide.prose a:hover { text-decoration: none; }
.study-guide.prose strong { font-weight: 600; }
.study-guide.prose em { font-style: italic; }
.study-guide.prose hr { border-color: var(--color-border); margin: 2rem 0; }
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
      <div className="study-guide grid min-w-0 grid-cols-1 gap-10 lg:grid-cols-[1fr,minmax(0,24rem)]">
        {/* Questions: on mobile order-2 (below passages); on lg order-1 (left column) */}
        <div className="order-2 min-w-0 lg:order-1">
          <div className="font-mono text-foreground leading-relaxed prose">
            <ReactMarkdown
              components={{
                a: linkComponent,
                h2: ({ children }) => (
                  <h2 className="border-b border-border/60 pb-3 pt-1 font-semibold tracking-wide text-foreground">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-muted-foreground">{children}</h3>
                ),
                ol: ({ children }) => (
                  <ol className="space-y-3 rounded-xl border border-border/40 bg-card/30 px-5 py-4 shadow-sm">
                    {children}
                  </ol>
                ),
                ul: ({ children }) => (
                  <ul className="space-y-2 rounded-lg border border-border/30 bg-card/20 px-4 py-3">{children}</ul>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Passages: on mobile order-1 (first, so you can read Bible without scrolling to bottom); on lg order-2 (right sidebar) */}
        <aside className="order-1 min-w-0 lg:order-2 lg:sticky lg:top-[var(--navbar-offset)] lg:self-start lg:max-h-[calc(100dvh-var(--navbar-offset)-2rem)] lg:overflow-y-auto">
          <div className="space-y-5 rounded-xl border border-border/50 bg-card/40 p-4 lg:p-0 lg:border-0 lg:bg-transparent">
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
