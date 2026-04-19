import { GRAMMAR_GLOSSARY } from "@/lib/greek-endings-reference"
import { cn } from "@/lib/utils"

/**
 * Distinct “lexicon” styling for grammar glossary terms (lesson sheet + Endings Lab).
 * Amber/ink palette separates this from emerald tables and violet lesson chrome.
 */
export function GrammarGlossaryTerms({
  layout = "stack",
  className,
  showIntro = false,
}: {
  layout?: "stack" | "grid"
  className?: string
  /** When true, renders a short lead-in above the cards (Endings Lab). */
  showIntro?: boolean
}) {
  return (
    <div className={cn(className)}>
      {showIntro ? (
        <div className="mb-4 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-950/35 via-black/40 to-black/60 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-200/80">Grammar lexicon</p>
          <p className="mt-1.5 text-sm leading-relaxed text-white/75">
            Each card ties a label to what it does in the sentence, with Greek examples and why the form fits.
          </p>
        </div>
      ) : null}

      <div
        className={cn(
          layout === "grid" ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : "flex flex-col gap-3",
        )}
      >
        {GRAMMAR_GLOSSARY.map((item, index) => (
          <article
            key={item.term}
            className={cn(
              "relative overflow-hidden rounded-2xl border border-amber-200/12",
              "bg-gradient-to-br from-[#1a1510]/95 via-[#0c0e14] to-[#050508]",
              "pl-[1.125rem] pr-4 py-4 shadow-[inset_0_1px_0_rgba(251,191,36,0.06),0_12px_40px_rgba(0,0,0,0.45)]",
            )}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-amber-300/90 via-amber-500/50 to-orange-700/35"
              aria-hidden
            />
            <div className="relative flex gap-3.5">
              <span
                className="mt-0.5 shrink-0 font-mono text-[10px] tabular-nums leading-none text-amber-600/70"
                aria-hidden
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1 space-y-3">
                <h3 className="font-serif text-[1.15rem] font-medium leading-snug tracking-tight text-amber-50/95 sm:text-[1.2rem]">
                  {item.term}
                </h3>
                <div className="space-y-1.5">
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-amber-100/45">What it means</p>
                  <p className="text-[13px] leading-relaxed text-white/82">{item.plainMeaning}</p>
                </div>
                <div className="space-y-1.5 rounded-xl border border-white/[0.07] bg-black/25 px-3 py-2.5">
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-amber-200/40">Examples &amp; nuance</p>
                  <p className="text-[12px] leading-relaxed text-white/72">{item.quickExample}</p>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
