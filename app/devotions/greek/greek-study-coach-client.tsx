"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Send } from "lucide-react"

import { buildStudyCoachProgressDigest } from "@/lib/greek-study-coach-context"
import { cn } from "@/lib/utils"

type ChatMessage = { role: "user" | "assistant"; content: string }

const STARTERS = [
  "What should I focus on this week based on my progress?",
  "I keep missing cases—what should I drill?",
  "How should I use the Word bank vs Verse Quest?",
  "Give me a 10-minute plan for today.",
] as const

function friendlyError(msg: string): string {
  if (/api key is not configured|openai api key/i.test(msg)) {
    return "The study coach is not configured on this server. Your progress is still saved locally."
  }
  if (/502|503|504|network|fetch|failed/i.test(msg)) {
    return "Could not reach the coach. Try again in a moment."
  }
  return msg
}

export function GreekStudyCoachClient({ className }: { className?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFollowUps, setLastFollowUps] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, scrollToBottom])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || loading) return
      setError(null)
      setLoading(true)
      setLastFollowUps([])

      const digest = buildStudyCoachProgressDigest()
      const history = messages.map((m) => ({ role: m.role, content: m.content }))

      setMessages((prev) => [...prev, { role: "user", content: trimmed }])
      setInput("")

      try {
        const res = await fetch("/api/devotions/greek-study-coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            progressDigest: digest,
            history,
          }),
        })
        const data = (await res.json()) as { reply?: string; followUps?: string[]; error?: string }
        if (!res.ok) {
          throw new Error(data?.error || "Request failed.")
        }
        const reply = typeof data.reply === "string" ? data.reply : ""
        const followUps = Array.isArray(data.followUps) ? data.followUps.filter((s) => typeof s === "string") : []
        setMessages((prev) => [...prev, { role: "assistant", content: reply || "…" }])
        setLastFollowUps(followUps.slice(0, 3))
      } catch (e) {
        const raw = e instanceof Error ? e.message : "Something went wrong."
        setError(friendlyError(raw))
        setMessages((prev) => prev.slice(0, -1))
      } finally {
        setLoading(false)
      }
    },
    [loading, messages],
  )

  return (
    <div className={cn("flex min-h-[60vh] flex-col", className)}>
      <div className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-950/20 px-3 py-2.5">
        <p className="text-xs leading-relaxed text-white/70">
          This coach reads your <strong className="text-white/90">saved progress</strong> on this device (XP, streak,
          weak words, milestones) each time you send a message—so advice stays in sync with your journey.
        </p>
      </div>

      <div className="min-h-[240px] flex-1 space-y-4 overflow-y-auto rounded-xl border border-white/10 bg-black/25 p-4">
        {messages.length === 0 && !loading ? (
          <div className="space-y-3">
            <p className="text-sm text-white/60">Try one of these, or ask anything about your Greek study path:</p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void sendMessage(s)}
                  disabled={loading}
                  className="rounded-full border border-white/15 bg-white/[0.05] px-3 py-1.5 text-left text-xs text-white/85 hover:bg-white/[0.1] disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((m, i) => (
          <div
            key={`${i}-${m.role}`}
            className={cn(
              "max-w-[min(100%,36rem)] rounded-xl px-3 py-2.5 text-sm leading-relaxed",
              m.role === "user"
                ? "ml-auto bg-emerald-500/15 text-white/95 border border-emerald-400/25"
                : "mr-auto bg-white/[0.06] text-white/88 border border-white/10",
            )}
          >
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/40 mb-1">
              {m.role === "user" ? "You" : "Coach"}
            </p>
            <p className="whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}

        {loading ? (
          <div className="flex items-center gap-2 text-white/55">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            <span className="text-sm">Thinking with your progress in view…</span>
          </div>
        ) : null}

        {error ? <p className="text-sm text-amber-200/90">{error}</p> : null}

        <div ref={bottomRef} />
      </div>

      {lastFollowUps.length > 0 && !loading ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {lastFollowUps.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => void sendMessage(chip)}
              className="rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100/95 hover:bg-emerald-500/18"
            >
              {chip}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          void sendMessage(input)
        }}
      >
        <label className="sr-only" htmlFor="greek-study-coach-input">
          Message to coach
        </label>
        <textarea
          id="greek-study-coach-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          placeholder="Ask about your study plan, weak areas, or how to use the labs…"
          className="min-h-[88px] w-full flex-1 resize-y rounded-xl border border-white/12 bg-black/35 px-3 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-emerald-400/40 focus:outline-none"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-400/45 bg-emerald-500/20 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-emerald-50 hover:bg-emerald-500/30 disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" aria-hidden />}
          Send
        </button>
      </form>
    </div>
  )
}
