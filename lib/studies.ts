/**
 * Bible studies (Notion-hosted) for fxarchives.
 *
 * HOW TO ADD A STUDY
 * ------------------
 * 1. Open this file: lib/studies.ts
 *
 * 2. Add a new object to the STUDIES array (copy the Jonah block below and edit):
 *    - id: unique key, e.g. "romans-2026"
 *    - slug: URL-friendly, e.g. "romans-2026"
 *    - title: full title
 *    - notionUrl: main study page on Notion (the overview page people open first)
 *    - summary: 1–2 sentences
 *    - guideLinks: array of { label: "Wk 1: ...", url: "https://...", slug: "wk-1" } for each week.
 *      If slug is set, add content/studies/{studySlug}/{slug}.md to host the guide on the site; otherwise the link goes to Notion.
 *    - podcastUrl (optional): Podbean series link
 *    - vaultUrl (optional): re:group vault link
 *    - tags (optional): e.g. ["Romans", "2026"]
 *    - year (optional): e.g. 2026
 *
 * 3. If this is the new current study, change CURRENT_STUDY_ID to the new study’s id.
 *
 * Optional – paste from Notion: save the Notion page text to a file, then run:
 *   pnpm exec tsx scripts/parse-study-paste.ts path/to/paste.txt
 * Copy the printed JSON into STUDIES, fix notionUrl if needed, then set CURRENT_STUDY_ID.
 */

export interface StudyGuideLink {
  label: string
  url: string
  /** If set, guide content is hosted locally at /studies/{studySlug}/{slug} */
  slug?: string
  /** Passage of the week: pre-filled in the verses sidebar (e.g. "Jonah 4:1-11") */
  defaultPassageRef?: string
}

export type StudyLeader = "mat" | "jason"

export interface BibleStudy {
  id: string
  title: string
  /** Short slug for URLs (e.g. "jonah-get-up-go") */
  slug: string
  /** Notion page URL for the main study page */
  notionUrl: string
  summary: string
  /** Week-by-week study guide links (from Notion) */
  guideLinks: StudyGuideLink[]
  /** Optional: series podcast (e.g. Podbean category) */
  podcastUrl?: string
  /** Optional: re:group vault or other resource */
  vaultUrl?: string
  /** Optional hashtags for display */
  tags?: string[]
  /** When this study is "current" (for ordering/display) */
  year?: number
  /** Study track for Mat's vs Jason's cards on studies page */
  leader?: StudyLeader
}

/** All studies: current first, then archive. */
export const STUDIES: BibleStudy[] = [
  {
    id: "jonah-2026",
    slug: "jonah-get-up-go",
    title: "Jonah: GET UP! GO!",
    notionUrl: "https://fxchurch.notion.site/Jonah-GET-UP-GO-2f4231166f6d80dba631f755f975758a",
    summary:
      "Get up! Go! This is the message God gives to His people. What if you refuse? God tells Jonah, \"Get up! Go to the great city of Nineveh and preach against it, because their wickedness.\" Instead, Jonah runs from God. When confronted, Jonah would rather die than obey God. In his darkest moment, he turns to God. Given another chance, Jonah obeys, but with a bad attitude. Join us as we explore Jonah and examine our Get Up! Go!",
    guideLinks: [
      { label: "Wk 1: The Word Came", url: "https://www.notion.so/Wk-1-The-Word-Came-2f4231166f6d8157a04feba149b920c6?pvs=21", slug: "wk-1" },
      { label: "Wk 2: Salvation is from the Lord", url: "https://www.notion.so/Wk-2-Salvation-is-from-the-Lord-303231166f6d80e094e7f5ef0c271fe9?pvs=21", slug: "wk-2" },
      { label: "Wk 3: The Word and The Decree", url: "https://www.notion.so/Wk-3-The-Word-and-The-Decree-304231166f6d80d689f3d2d5c21a30f1?pvs=21", slug: "wk-3" },
      { label: "Wk 4: Is it right to be angry?", url: "https://www.notion.so/Wk-4-Is-it-right-to-be-angry-310231166f6d8069928ac4f6394b6e43?pvs=21", slug: "wk-4", defaultPassageRef: "Jonah 4:1-11" },
    ],
    podcastUrl: "https://fxtalk.podbean.com/category/2501",
    vaultUrl: "http://fxchur.ch/rgvault",
    tags: ["Jonah", "2026"],
    year: 2026,
  },
]

/** Id of the study to feature as "current" on the studies page. */
export const CURRENT_STUDY_ID = "jonah-2026"

export function getCurrentStudy(): BibleStudy | null {
  return STUDIES.find((s) => s.id === CURRENT_STUDY_ID) ?? STUDIES[0] ?? null
}

export function getStudyBySlug(slug: string): BibleStudy | null {
  return STUDIES.find((s) => s.slug === slug) ?? null
}

export function getAllStudies(): BibleStudy[] {
  return [...STUDIES]
}

/**
 * Merge DB studies with hardcoded STUDIES. DB versions win for matching slugs;
 * hardcoded studies that don't exist in DB are appended so nothing is lost.
 */
function mergeStudies(dbStudies: BibleStudy[]): BibleStudy[] {
  const dbSlugs = new Set(dbStudies.map((s) => s.slug))
  const hardcodedOnly = STUDIES.filter((s) => !dbSlugs.has(s.slug))
  return [...dbStudies, ...hardcodedOnly]
}

/** Async versions that merge database + hardcoded data. */
export async function getAllStudiesAsync(): Promise<BibleStudy[]> {
  try {
    const { getStudiesFromDb } = await import("./studies-db")
    const db = await getStudiesFromDb()
    if (db && db.studies.length > 0) return mergeStudies(db.studies)
  } catch {}
  return getAllStudies()
}

export async function getCurrentStudyAsync(): Promise<BibleStudy | null> {
  try {
    const { getStudiesFromDb } = await import("./studies-db")
    const db = await getStudiesFromDb()
    if (db && db.studies.length > 0) {
      const all = mergeStudies(db.studies)
      return all.find((s) => s.id === db.currentId) ?? all[0] ?? null
    }
  } catch {}
  return getCurrentStudy()
}

export async function getStudyBySlugAsync(slug: string): Promise<BibleStudy | null> {
  try {
    const { getStudiesFromDb } = await import("./studies-db")
    const db = await getStudiesFromDb()
    if (db && db.studies.length > 0) {
      const all = mergeStudies(db.studies)
      return all.find((s) => s.slug === slug) ?? null
    }
  } catch {}
  return getStudyBySlug(slug)
}

/** For the studies page: Mat's and Jason's study cards. Mat fallback: current study from merged list. */
export async function getStudiesByLeaderAsync(): Promise<{
  matStudy: BibleStudy | null
  jasonStudy: BibleStudy | null
}> {
  try {
    const { getStudiesFromDb } = await import("./studies-db")
    const db = await getStudiesFromDb()
    const all = db && db.studies.length > 0 ? mergeStudies(db.studies) : getAllStudies()

    const matStudy =
      all.find((s) => s.leader === "mat") ??
      (db?.currentId ? all.find((s) => s.id === db.currentId) : null) ??
      getCurrentStudy() ??
      all[0] ??
      null
    const jasonStudy = all.find((s) => s.leader === "jason") ?? null
    return { matStudy, jasonStudy }
  } catch {
    const current = getCurrentStudy()
    return { matStudy: current, jasonStudy: null }
  }
}

/**
 * Parse pasted Notion-style text into a partial BibleStudy for adding new studies.
 * Paste the title, summary, and study guide list from Notion; this extracts links and text.
 * Usage: run in Node or use in a small script; paste result into STUDIES in lib/studies.ts.
 *
 * Example input format:
 *   # Jonah: GET UP! GO!
 *   ### Series Summary:
 *   **Get up! Go!** This is the message...
 *   ### **Study Guides:**
 *   [Wk 1: The Word Came](https://www.notion.so/...)
 *   listen to the [series podcast](https://...) or browse the [re:group vault](http://...)
 */
export function parseStudyFromNotionPaste(pasted: string): Partial<BibleStudy> & { title: string; notionUrl: string } {
  const lines = pasted.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  let title = ""
  let summary = ""
  const guideLinks: StudyGuideLink[] = []
  let notionUrl = ""
  let podcastUrl: string | undefined
  let vaultUrl: string | undefined

  // Title: first # line
  const titleLine = lines.find((l) => l.startsWith("# "))
  if (titleLine) title = titleLine.replace(/^#+\s*/, "").trim()

  // Summary: block after "Series Summary" or "Summary" until "Study Guides" or next ##
  let inSummary = false
  let inGuides = false
  const summaryParts: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lower = line.toLowerCase()
    if (lower.includes("series summary") || (lower.includes("summary") && line.startsWith("**"))) inSummary = true
    if (lower.includes("study guides")) {
      inSummary = false
      inGuides = true
      continue
    }
    if (inSummary && line && !line.startsWith("###") && !line.startsWith("---")) {
      summaryParts.push(line.replace(/\*\*/g, ""))
    }
    if (inGuides) {
      // Match [label](url)
      const linkMatch = line.match(/\[([^\]]+)\]\((https?:\S+)\)/g)
      if (linkMatch) {
        for (const m of linkMatch) {
          const [, label, url] = m.match(/\[([^\]]+)\]\((https?:\S+)\)/) ?? []
          if (label && url) {
            if (url.includes("notion") && !notionUrl) notionUrl = url
            if (label.toLowerCase().includes("wk ") || label.toLowerCase().includes("week ")) guideLinks.push({ label, url })
            if (label.toLowerCase().includes("podcast")) podcastUrl = url
            if (label.toLowerCase().includes("vault") || label.toLowerCase().includes("re:group")) vaultUrl = url
          }
        }
      }
    }
    // Also catch "listen to the [series podcast](url)" and "browse the ... [re:group vault](url)"
    const listenMatch = line.match(/\[([^\]]+)\]\((https?:\S+)\)/g)
    if (listenMatch && !podcastUrl) {
      for (const m of listenMatch) {
        const [, label, url] = m.match(/\[([^\]]+)\]\((https?:\S+)\)/) ?? []
        if (label && url && (label.toLowerCase().includes("podcast") || label.toLowerCase().includes("series"))) podcastUrl = url
        if (label && url && (label.toLowerCase().includes("vault") || label.toLowerCase().includes("re:group"))) vaultUrl = url
      }
    }
  }

  summary = summaryParts.join(" ").replace(/\s+/g, " ").trim()
  if (!notionUrl && title) notionUrl = "https://fxchurch.notion.site/" + title.replace(/\s+/g, "-")

  return {
    title,
    notionUrl,
    summary: summary || undefined,
    guideLinks: guideLinks.length ? guideLinks : undefined,
    podcastUrl,
    vaultUrl,
  }
}

/**
 * Result of parsing a pasted week/study blob for the admin "Paste to autofill" flow.
 * Used to prefill the study form and one guide from pasted content (e.g. Week 1 from Notion/email).
 */
export type ParsedPasteResult = {
  summary: string
  title: string
  podcast_url: string
  vault_url: string
  default_passage_ref: string
  guide_label: string
  content_md: string
}

/**
 * Parse a pasted week or study guide (e.g. "here is week 1 from a different study" with Series Summary, READ:, podcast/vault links).
 * Extracts summary, title hint, podcast/vault URLs, first passage ref, and uses the full text as the guide content.
 */
export function parsePastedWeekContent(pasted: string): ParsedPasteResult {
  const raw = pasted.trim()
  let summary = ""
  let title = ""
  let podcast_url = ""
  let vault_url = ""
  let default_passage_ref = ""
  const guide_label = "Week 1"

  const lines = raw.split(/\r?\n/)

  // Series Summary: take the block after "### Series Summary:" or "Series Summary:" until next ## or ---
  const summaryHeader = /^#*\s*Series Summary\s*:?\s*$/i
  let inSummary = false
  const summaryLines: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (summaryHeader.test(line.trim())) {
      inSummary = true
      continue
    }
    if (inSummary) {
      if (/^#+\s|\s*---\s*$/.test(line) || (line.trim().startsWith("##") && line.trim().length > 2)) break
      if (line.trim()) summaryLines.push(line.trim())
    }
  }
  summary = summaryLines.join(" ").replace(/\s+/g, " ").trim()

  // Title hint from summary: e.g. "gospel of John" + "πιστεύω" or "*#John #2025*"
  const hashJohn = raw.match(/#John\s*#?\s*(\d{4})?/i)
  const pisteuoMatch = raw.match(/πιστεύω|pisteuo/i)
  const year = raw.match(/#(\d{4})\b|\b(20\d{2})\b/)?.[1] ?? raw.match(/\b(20\d{2})\b/)?.[0]
  if (hashJohn || pisteuoMatch) {
    title = [pisteuoMatch ? "John: πιστεύω" : "John", year].filter(Boolean).join(" ")
  }

  // Podcast URL: [series podcast](url) or podbean
  const podcastLink = raw.match(/\[([^\]]*series[^\]]*podcast[^\]]*|[^\]]*podcast[^\]]*)\]\((https?:\S+)\)/i)
    ?? raw.match(/(https:\/\/[^\s)]*podbean[^\s)]*)/i)
  if (podcastLink) podcast_url = (podcastLink[2] ?? podcastLink[1] ?? "").replace(/[)\]>\s]+$/, "")

  // Vault URL: [re:group vault](url) or fxchur.ch/rgvault
  const vaultLink = raw.match(/\[([^\]]*re:?group[^\]]*vault[^\]]*|[^\]]*vault[^\]]*)\]\((https?:\S+)\)/i)
    ?? raw.match(/(https?:\/\/fxchur\.ch\/rgvault\S*)/i)
  if (vaultLink) vault_url = (vaultLink[2] ?? vaultLink[1] ?? "").replace(/[)\]>\s]+$/, "")

  // First READ: **READ: [John 1:1-18](url)** or READ: [John 1:1-18](url) — use link text as passage ref
  const readMatch = raw.match(/\*\*READ:\*\*\s*\[([^\]]+)\]\([^)]+\)|READ:\s*\[([^\]]+)\]\([^)]+\)/i)
  if (readMatch) {
    const ref = (readMatch[1] ?? readMatch[2] ?? "").trim()
    if (ref && /\d+:\d+/.test(ref)) default_passage_ref = ref
  }

  return {
    summary,
    title: title || "New Study",
    podcast_url,
    vault_url,
    default_passage_ref,
    guide_label,
    content_md: raw,
  }
}
