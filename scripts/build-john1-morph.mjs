#!/usr/bin/env node
/**
 * Downloads MorphGNT (morphgnt/sblgnt) 64-Jn-morphgnt.txt and writes lib/bible/morph-data/john-1.json
 * Parsing/lemmatization: CC-BY-SA 3.0 — see https://github.com/morphgnt/sblgnt
 * Run: node scripts/build-john1-morph.mjs
 */
import { writeFileSync, mkdirSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const OUT = join(ROOT, "lib/bible/morph-data/john-1.json")
const URL = "https://raw.githubusercontent.com/morphgnt/sblgnt/master/64-Jn-morphgnt.txt"

const res = await fetch(URL)
if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
const text = await res.text()

/** @type {Record<string, Array<{ text: string, word: string, lemma: string, pos: string, parse: string }>>} */
const verses = {}

for (const line of text.split("\n")) {
  const trimmed = line.trim()
  if (!trimmed) continue
  const parts = trimmed.split(/\s+/)
  if (parts.length < 7) continue
  const bcv = parts[0]
  if (!bcv.startsWith("0401")) continue
  const pos = parts[1]
  const parse = parts[2]
  const lemma = parts[parts.length - 1]
  const norm = parts[parts.length - 2]
  const word = parts[parts.length - 3]
  const textField = parts[parts.length - 4]
  const verseNum = String(parseInt(bcv.slice(4, 6), 10))
  if (!verses[verseNum]) verses[verseNum] = []
  verses[verseNum].push({
    text: textField,
    word,
    norm,
    lemma,
    pos,
    parse,
  })
}

const payload = {
  meta: {
    source: "MorphGNT: SBLGNT Edition",
    cite: "Tauber, J. K., ed. (2017) MorphGNT: SBLGNT Edition. https://github.com/morphgnt/sblgnt",
    parsingLicense: "CC-BY-SA 3.0 (morphological parsing and lemmatization)",
    textLicenseNote:
      "Greek text from SBL Greek New Testament; see SBLGNT EULA at https://sblgnt.com/license/",
  },
  bookSlug: "john",
  chapter: 1,
  verses,
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(payload, null, 0) + "\n", "utf8")
console.log(`Wrote ${OUT} (${Object.keys(verses).length} verses)`)
