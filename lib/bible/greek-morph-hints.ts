/**
 * Tiny under-word labels for “training wheels” mode in the Greek line (MorphGNT pilot chapters).
 */

import type { GreekMorphToken } from "@/lib/bible/morph-types"

function normParse(p: string): string {
  const raw = (p || "").trim()
  if (raw.length >= 8) return raw.slice(0, 8)
  return raw.padEnd(8, "-")
}

const T: Record<string, string> = { P: "pres", I: "impf", F: "fut", A: "aor", X: "perf", Y: "plup", T: "futpf" }
const V: Record<string, string> = { A: "act", M: "mid", P: "pas" }
const M: Record<string, string> = { I: "ind", D: "impv", S: "subj", O: "opt", N: "inf", P: "ptc" }
const C: Record<string, string> = { N: "nom", G: "gen", D: "dat", A: "acc", V: "voc" }

/** Short hint like "aor.act.ind" or "pres.mid.ptc·nom" for under-word display. */
export function getMorphHintAbbrev(token: GreekMorphToken): string | null {
  const parseRaw = token.parse.trim()
  if (!parseRaw || parseRaw.replace(/-/g, "").length === 0) return null

  const p = normParse(parseRaw)

  if (token.pos.startsWith("V")) {
    const mood = p[3]
    if (mood === "P") {
      const t = p[1] !== "-" ? T[p[1]] ?? p[1] : "?"
      const v = p[2] !== "-" ? V[p[2]] ?? p[2] : "?"
      const cs = p[4] !== "-" ? C[p[4]] ?? p[4] : "?"
      return `${t}.${v}.ptc·${cs}`
    }
    if (mood === "N") {
      const t = p[1] !== "-" ? T[p[1]] ?? p[1] : "?"
      const v = p[2] !== "-" ? V[p[2]] ?? p[2] : "?"
      return `${t}.${v}.inf`
    }
    const t = p[1] !== "-" ? T[p[1]] ?? p[1] : "?"
    const v = p[2] !== "-" ? V[p[2]] ?? p[2] : "?"
    const m = p[3] !== "-" ? M[p[3]] ?? p[3] : "?"
    return `${t}.${v}.${m}`
  }

  if (token.pos === "A-" || token.pos === "N-" || token.pos.startsWith("R") || token.pos === "RA") {
    const cs = p[4] !== "-" ? C[p[4]] ?? p[4] : "?"
    const num = p[5] === "S" ? "sg" : p[5] === "P" ? "pl" : "?"
    const gen =
      p[6] === "M" ? "m" : p[6] === "F" ? "f" : p[6] === "N" ? "n" : "?"
    return `${cs}.${num}.${gen}`
  }

  return null
}
