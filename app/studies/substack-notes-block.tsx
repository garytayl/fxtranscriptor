"use client"

import { useEffect, useState } from "react"
import { Newspaper, ExternalLink, ChevronRight } from "lucide-react"

type SubstackPost = { title: string; link: string; pubDate: string }

export function SubstackNotesBlock({ substackUrl, feedUrl }: { substackUrl: string; feedUrl: string }) {
  const [posts, setPosts] = useState<SubstackPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const url = `/api/studies/substack-feed?url=${encodeURIComponent(feedUrl)}`
    fetch(url)
      .then((r) => r.json())
      .then((data) => setPosts(Array.isArray(data.posts) ? data.posts : []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }, [feedUrl])

  return (
    <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-border">
      <a
        href={substackUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-accent hover:underline mb-3 sm:mb-4 min-h-[44px] sm:min-h-0"
      >
        <Newspaper className="size-4" />
        Leader notes on Substack
        <ExternalLink className="size-3" />
      </a>
      {loading ? (
        <p className="font-mono text-[11px] text-muted-foreground">Loading recent notes…</p>
      ) : posts.length > 0 ? (
        <ul className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Recent posts</p>
          {posts.map((p) => (
            <li key={p.link}>
              <a
                href={p.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2 font-sans text-sm text-muted-foreground hover:text-accent transition-colors"
              >
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground group-hover:text-accent transition-colors" />
                <span className="line-clamp-2">{p.title}</span>
                <ExternalLink className="size-3 shrink-0 opacity-60 group-hover:opacity-100" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
