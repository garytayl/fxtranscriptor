#!/usr/bin/env node
/**
 * Build MorphGNT JSON chapter datasets for the full New Testament.
 *
 * Outputs:
 * - lib/bible/morph-data/<book-slug>-<chapter>.json
 * - lib/bible/morph-data/nt-catalog.json (client-safe chapter metadata)
 *
 * Run:
 *   node scripts/build-nt-morph.mjs
 */
import { mkdirSync, writeFileSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const OUT_DIR = join(ROOT, "lib/bible/morph-data")
const CATALOG_OUT = join(OUT_DIR, "nt-catalog.json")
const DATASETS_TS_OUT = join(OUT_DIR, "nt-datasets.generated.ts")
const BASE_URL = "https://raw.githubusercontent.com/morphgnt/sblgnt/master"

const MORPH_META = {
  source: "MorphGNT: SBLGNT Edition",
  cite: "Tauber, J. K., ed. (2017) MorphGNT: SBLGNT Edition. https://github.com/morphgnt/sblgnt",
  parsingLicense: "CC-BY-SA 3.0 (morphological parsing and lemmatization)",
  textLicenseNote: "Greek text from SBL Greek New Testament; see SBLGNT EULA at https://sblgnt.com/license/",
}

const NT_BOOKS = [
  { id: "MAT", morphFile: "61-Mt-morphgnt.txt", slug: "matthew", name: "Matthew", chapterCount: 28 },
  { id: "MRK", morphFile: "62-Mk-morphgnt.txt", slug: "mark", name: "Mark", chapterCount: 16 },
  { id: "LUK", morphFile: "63-Lk-morphgnt.txt", slug: "luke", name: "Luke", chapterCount: 24 },
  { id: "JHN", morphFile: "64-Jn-morphgnt.txt", slug: "john", name: "John", chapterCount: 21 },
  { id: "ACT", morphFile: "65-Ac-morphgnt.txt", slug: "acts", name: "Acts", chapterCount: 28 },
  { id: "ROM", morphFile: "66-Ro-morphgnt.txt", slug: "romans", name: "Romans", chapterCount: 16 },
  { id: "1CO", morphFile: "67-1Co-morphgnt.txt", slug: "1-corinthians", name: "1 Corinthians", chapterCount: 16 },
  { id: "2CO", morphFile: "68-2Co-morphgnt.txt", slug: "2-corinthians", name: "2 Corinthians", chapterCount: 13 },
  { id: "GAL", morphFile: "69-Ga-morphgnt.txt", slug: "galatians", name: "Galatians", chapterCount: 6 },
  { id: "EPH", morphFile: "70-Eph-morphgnt.txt", slug: "ephesians", name: "Ephesians", chapterCount: 6 },
  { id: "PHP", morphFile: "71-Php-morphgnt.txt", slug: "philippians", name: "Philippians", chapterCount: 4 },
  { id: "COL", morphFile: "72-Col-morphgnt.txt", slug: "colossians", name: "Colossians", chapterCount: 4 },
  { id: "1TH", morphFile: "73-1Th-morphgnt.txt", slug: "1-thessalonians", name: "1 Thessalonians", chapterCount: 5 },
  { id: "2TH", morphFile: "74-2Th-morphgnt.txt", slug: "2-thessalonians", name: "2 Thessalonians", chapterCount: 3 },
  { id: "1TI", morphFile: "75-1Ti-morphgnt.txt", slug: "1-timothy", name: "1 Timothy", chapterCount: 6 },
  { id: "2TI", morphFile: "76-2Ti-morphgnt.txt", slug: "2-timothy", name: "2 Timothy", chapterCount: 4 },
  { id: "TIT", morphFile: "77-Tit-morphgnt.txt", slug: "titus", name: "Titus", chapterCount: 3 },
  { id: "PHM", morphFile: "78-Phm-morphgnt.txt", slug: "philemon", name: "Philemon", chapterCount: 1 },
  { id: "HEB", morphFile: "79-Heb-morphgnt.txt", slug: "hebrews", name: "Hebrews", chapterCount: 13 },
  { id: "JAS", morphFile: "80-Jas-morphgnt.txt", slug: "james", name: "James", chapterCount: 5 },
  { id: "1PE", morphFile: "81-1Pe-morphgnt.txt", slug: "1-peter", name: "1 Peter", chapterCount: 5 },
  { id: "2PE", morphFile: "82-2Pe-morphgnt.txt", slug: "2-peter", name: "2 Peter", chapterCount: 3 },
  { id: "1JN", morphFile: "83-1Jn-morphgnt.txt", slug: "1-john", name: "1 John", chapterCount: 5 },
  { id: "2JN", morphFile: "84-2Jn-morphgnt.txt", slug: "2-john", name: "2 John", chapterCount: 1 },
  { id: "3JN", morphFile: "85-3Jn-morphgnt.txt", slug: "3-john", name: "3 John", chapterCount: 1 },
  { id: "JUD", morphFile: "86-Jud-morphgnt.txt", slug: "jude", name: "Jude", chapterCount: 1 },
  { id: "REV", morphFile: "87-Re-morphgnt.txt", slug: "revelation", name: "Revelation", chapterCount: 22 },
]

/**
 * @typedef {{ text: string, word: string, norm: string, lemma: string, pos: string, parse: string }} Token
 */

mkdirSync(OUT_DIR, { recursive: true })

/** @type {Array<{ bookSlug: string; bookName: string; chapter: number; label: string; tagline: string; maxVerse: number }>} */
const catalog = []
/** @type {string[]} */
const datasetPaths = []
let filesWritten = 0

for (const book of NT_BOOKS) {
  const res = await fetch(`${BASE_URL}/${book.morphFile}`)
  if (!res.ok) throw new Error(`Failed downloading ${book.morphFile}: ${res.status}`)
  const text = await res.text()

  /** @type {Map<number, Record<string, Token[]>>} */
  const byChapter = new Map()

  for (let ch = 1; ch <= book.chapterCount; ch++) {
    byChapter.set(ch, {})
  }

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim()
    if (!line) continue
    const parts = line.split(/\s+/)
    if (parts.length < 7) continue

    const bcv = parts[0]
    const chapter = Number.parseInt(bcv.slice(2, 4), 10)
    const verse = Number.parseInt(bcv.slice(4, 6), 10)
    if (!Number.isFinite(chapter) || !Number.isFinite(verse)) continue
    if (!byChapter.has(chapter)) continue

    const pos = parts[1]
    const parse = parts[2]
    const lemma = parts[parts.length - 1]
    const norm = parts[parts.length - 2]
    const word = parts[parts.length - 3]
    const textField = parts[parts.length - 4]

    const chapterVerses = byChapter.get(chapter)
    if (!chapterVerses) continue
    const verseKey = String(verse)
    if (!chapterVerses[verseKey]) chapterVerses[verseKey] = []
    chapterVerses[verseKey].push({
      text: textField,
      word,
      norm,
      lemma,
      pos,
      parse,
    })
  }

  for (let chapter = 1; chapter <= book.chapterCount; chapter++) {
    const verses = byChapter.get(chapter) ?? {}
    const verseNumbers = Object.keys(verses).map((x) => Number.parseInt(x, 10)).filter(Number.isFinite)
    const maxVerse = verseNumbers.length > 0 ? Math.max(...verseNumbers) : 1

    const outPayload = {
      meta: MORPH_META,
      bookSlug: book.slug,
      chapter,
      verses,
    }

    const outPath = join(OUT_DIR, `${book.slug}-${chapter}.json`)
    writeFileSync(outPath, `${JSON.stringify(outPayload)}\n`, "utf8")
    filesWritten += 1
    datasetPaths.push(`${book.slug}-${chapter}.json`)

    catalog.push({
      bookSlug: book.slug,
      bookName: book.name,
      chapter,
      label: `${book.name} ${chapter}`,
      tagline: "Read and study Koine Greek in context.",
      maxVerse,
    })
  }
}

writeFileSync(CATALOG_OUT, `${JSON.stringify(catalog)}\n`, "utf8")

const importLines = datasetPaths.map(
  (datasetPath, idx) => `import d${idx} from "@/lib/bible/morph-data/${datasetPath}"`,
)
const datasetVars = datasetPaths.map((_, idx) => `d${idx}`)
const generatedSource =
  `${importLines.join("\n")}\n\n` +
  `export const NT_MORPH_CHAPTER_DATA = [\n  ${datasetVars.join(",\n  ")}\n] as const\n`
writeFileSync(DATASETS_TS_OUT, generatedSource, "utf8")

console.log(`Wrote ${filesWritten} chapter files + nt-catalog.json + nt-datasets.generated.ts`)
