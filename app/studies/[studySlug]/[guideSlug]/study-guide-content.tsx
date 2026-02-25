import React from "react"
import ReactMarkdown from "react-markdown"
import { parsePassageReference, parsePassageList } from "@/lib/bible/reference"
import { InlinePassage } from "./inline-passage"

const prose = `
.study-guide.prose h1 { font-size: 1.5rem; font-weight: 600; margin-top: 2rem; margin-bottom: 0.75rem; }
.study-guide.prose h2 { font-size: 1.25rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.5rem; }
.study-guide.prose h3 { font-size: 1.1rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.5rem; }
.study-guide.prose p { margin-bottom: 0.75rem; line-height: 1.6; }
.study-guide.prose ul, .study-guide.prose ol { margin-bottom: 1rem; padding-left: 1.5rem; }
.study-guide.prose li { margin-bottom: 0.25rem; }
.study-guide.prose a { color: var(--color-accent); text-decoration: underline; }
.study-guide.prose a:hover { text-decoration: none; }
.study-guide.prose strong { font-weight: 600; }
.study-guide.prose em { font-style: italic; }
.study-guide.prose hr { border-color: var(--color-border); margin: 1.5rem 0; }
`

function getLinkText(children: React.ReactNode): string {
  if (typeof children === "string") return children.trim()
  if (Array.isArray(children)) return children.map(getLinkText).join("").trim()
  const el = children as React.ReactElement<{ children?: React.ReactNode }> | undefined
  if (el?.props?.children != null) return getLinkText(el.props.children)
  return ""
}

export function StudyGuideContent({ content }: { content: string }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: prose }} />
      <div className="font-mono text-sm text-foreground leading-relaxed">
        <ReactMarkdown
          components={{
            a: ({ href, children }) => {
              const text = getLinkText(children)
              const list = text.includes(",") ? parsePassageList(text) : null
              if (list && list.length > 0) {
                return (
                  <>
                    {list.map((p, i) => (
                      <InlinePassage key={`${p.raw}-${i}`} ref={p.raw} />
                    ))}
                  </>
                )
              }
              const single = parsePassageReference(text)
              if (single) {
                return <InlinePassage ref={single.raw} />
              }
              return (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline hover:no-underline">
                  {children}
                </a>
              )
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </>
  )
}
