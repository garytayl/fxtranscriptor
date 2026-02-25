/**
 * Bible studies (Notion-hosted) for FX Archive.
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

/** Async versions that check the database first, falling back to hardcoded data. */
export async function getAllStudiesAsync(): Promise<BibleStudy[]> {
  try {
    const { getStudiesFromDb } = await import("./studies-db")
    const db = await getStudiesFromDb()
    if (db && db.studies.length > 0) return db.studies
  } catch {}
  return getAllStudies()
}

export async function getCurrentStudyAsync(): Promise<BibleStudy | null> {
  try {
    const { getStudiesFromDb } = await import("./studies-db")
    const db = await getStudiesFromDb()
    if (db && db.studies.length > 0) {
      return db.studies.find((s) => s.id === db.currentId) ?? db.studies[0] ?? null
    }
  } catch {}
  return getCurrentStudy()
}

export async function getStudyBySlugAsync(slug: string): Promise<BibleStudy | null> {
  try {
    const { getStudiesFromDb } = await import("./studies-db")
    const db = await getStudiesFromDb()
    if (db && db.studies.length > 0) {
      return db.studies.find((s) => s.slug === slug) ?? null
    }
  } catch {}
  return getStudyBySlug(slug)
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
