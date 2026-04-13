"use client"

import { BookOpen, GraduationCap } from "lucide-react"

/**
 * Visible "start here" grammar intro for NT MorphGNT chapters.
 */
export function GreekGrammarPrimer({
  wordHintsEnabled,
  onToggleWordHints,
}: {
  wordHintsEnabled: boolean
  onToggleWordHints: () => void
}) {
  return (
    <div className="rounded-lg border border-amber-500/35 bg-gradient-to-b from-amber-500/10 to-background overflow-hidden">
      <div className="flex items-start gap-3 px-3 py-3 sm:px-4 sm:py-3.5 border-b border-amber-500/20">
        <GraduationCap className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground tracking-tight">Learn Greek as you read</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Tap any word in the gold Greek line for a full breakdown. Use the primer below for tenses, moods,
            participles, and cases, then jump back into your chapter and tap words in context.
          </p>
        </div>
      </div>

      <div className="px-3 sm:px-4 py-2 flex flex-wrap items-center gap-2 border-b border-border/60 bg-muted/20">
        <button
          type="button"
          onClick={onToggleWordHints}
          className={`text-[11px] font-mono uppercase tracking-wider px-2.5 py-1.5 rounded-md border transition-colors ${
            wordHintsEnabled
              ? "border-amber-500/60 bg-amber-500/15 text-foreground"
              : "border-border bg-card/80 text-muted-foreground hover:text-foreground"
          }`}
        >
          {wordHintsEnabled ? "Hide word hints" : "Show word hints"}
        </button>
        <span className="text-[10px] text-muted-foreground">
          Tiny codes under each Greek word (e.g. aor.act.ind, pres.mid.ptc·nom).
        </span>
      </div>

      <details>
        <summary className="cursor-pointer list-none px-3 sm:px-4 py-2.5 text-xs font-medium text-foreground flex items-center gap-2 hover:bg-muted/30">
          <BookOpen className="size-3.5 text-amber-600/90 shrink-0" />
          <span>Tenses, moods, participles &amp; cases — quick guide</span>
        </summary>
        <div className="px-3 sm:px-4 pb-4 pt-1 space-y-4 text-xs leading-relaxed text-muted-foreground border-t border-border/40">
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground mb-1.5">Tenses (verbs)</h3>
            <ul className="list-disc pl-4 space-y-1.5">
              <li>
                <span className="text-foreground/90">Present</span> — often ongoing, repeated, or dramatic narrative
                present (context decides).
              </li>
              <li>
                <span className="text-foreground/90">Imperfect</span> — past with “texture”: was doing, used to,
                background.
              </li>
              <li>
                <span className="text-foreground/90">Aorist</span> — the default “story” past: action viewed as a whole;
                very common for main events.
              </li>
              <li>
                <span className="text-foreground/90">Perfect</span> — past action with ongoing result or state.
              </li>
              <li>
                <span className="text-foreground/90">Future</span> — looks ahead from the moment of speech.
              </li>
            </ul>
          </section>
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground mb-1.5">Moods (finite verbs)</h3>
            <ul className="list-disc pl-4 space-y-1.5">
              <li>
                <span className="text-foreground/90">Indicative</span> — statements of fact: “is / was / did.”
              </li>
              <li>
                <span className="text-foreground/90">Imperative</span> — commands and requests.
              </li>
              <li>
                <span className="text-foreground/90">Subjunctive</span> — purpose, exhortation, indefinite contexts;
                often with ἵνα for purpose.
              </li>
            </ul>
          </section>
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground mb-1.5">Participles</h3>
            <p>
              A participle is still a verb, but it behaves like an adjective: “the one who…,” “while …ing,” “having
              …ed.” It will have its own tense and voice, plus case/number/gender so it can attach to a noun or stand
              in for one.
            </p>
          </section>
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground mb-1.5">Infinitives</h3>
            <p>The “to …” form. Greek often chains infinitives with main verbs for purpose, result, or indirect speech.</p>
          </section>
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground mb-1.5">Cases (nouns, adjectives, articles)</h3>
            <ul className="list-disc pl-4 space-y-1.5">
              <li>
                <span className="text-foreground/90">Nominative</span> — subject or predicate nominative.
              </li>
              <li>
                <span className="text-foreground/90">Genitive</span> — often possession, source, “of …”
              </li>
              <li>
                <span className="text-foreground/90">Dative</span> — indirect object, reference, location, “to/for/with.”
              </li>
              <li>
                <span className="text-foreground/90">Accusative</span> — often the direct object.
              </li>
            </ul>
          </section>
        </div>
      </details>
    </div>
  )
}
