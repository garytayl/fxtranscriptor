#!/usr/bin/env node
/**
 * Builds lib/bible/data/strongs-kjv-unique-english.json from OpenScriptures Strong's
 * dictionaries (kjv_def glosses). Only words that map to exactly one G or one H
 * across all entries are kept (reduces wrong sense for homographs).
 *
 * Run: node scripts/build-strongs-word-fallback.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, "../lib/bible/data/strongs-kjv-unique-english.json")

const JSDELIVR_GREEK =
  "https://cdn.jsdelivr.net/gh/openscriptures/strongs@master/greek/strongs-greek-dictionary.js"
const JSDELIVR_HEBREW =
  "https://cdn.jsdelivr.net/gh/openscriptures/strongs@master/hebrew/strongs-hebrew-dictionary.js"

function extractJsonFromJs(text) {
  const trimmed = text.replace(/^\uFEFF/, "").trim()
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON object in response")
  return trimmed.slice(start, end + 1)
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  return extractJsonFromJs(await res.text())
}

/** Split kjv_def into rough English tokens (lowercase). */
function* tokensFromKjvDef(kjvDef) {
  if (!kjvDef || typeof kjvDef !== "string") return
  const noParen = kjvDef.replace(/\([^)]*\)/g, " ")
  const parts = noParen.split(/[,;/]/)
  for (const part of parts) {
    for (const raw of part.split(/\s+/)) {
      const t = raw.replace(/^[^a-zA-Z']+/, "").replace(/[^a-zA-Z']+$/, "").toLowerCase()
      if (t.length >= 2 && /^[a-z']+$/.test(t)) yield t
    }
  }
}

function buildUniqueMap(dictJson) {
  /** @type {Map<string, Set<string>>} */
  const wordToCodes = new Map()
  const dict = JSON.parse(dictJson)
  for (const [code, entry] of Object.entries(dict)) {
    const kjv = entry?.kjv_def
    if (!kjv) continue
    for (const w of tokensFromKjvDef(kjv)) {
      if (!wordToCodes.has(w)) wordToCodes.set(w, new Set())
      wordToCodes.get(w).add(code)
    }
  }
  /** @type {Record<string, string>} */
  const unique = {}
  for (const [w, set] of wordToCodes) {
    if (set.size === 1) {
      unique[w] = [...set][0]
    }
  }
  return unique
}

async function main() {
  console.log("Fetching Greek dictionary…")
  const greekJson = await fetchJson(JSDELIVR_GREEK)
  console.log("Fetching Hebrew dictionary…")
  const hebrewJson = await fetchJson(JSDELIVR_HEBREW)

  const greek = buildUniqueMap(greekJson)
  const hebrew = buildUniqueMap(hebrewJson)

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify({ greek, hebrew }, null, 0), "utf8")
  console.log(`Wrote ${OUT}`)
  console.log(`  Greek unique words: ${Object.keys(greek).length}`)
  console.log(`  Hebrew unique words: ${Object.keys(hebrew).length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
