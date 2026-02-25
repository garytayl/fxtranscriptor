import ReactMarkdown from "react-markdown"

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

export function StudyGuideContent({ content }: { content: string }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: prose }} />
      <div className="font-mono text-sm text-foreground leading-relaxed">
        <ReactMarkdown
          components={{
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline hover:no-underline">
                {children}
              </a>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </>
  )
}
