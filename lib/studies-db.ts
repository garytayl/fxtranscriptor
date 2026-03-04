import type { BibleStudy, StudyGuideLink, StudyLeader } from "./studies"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

type DbStudy = {
  id: string
  slug: string
  title: string
  notion_url: string
  summary: string
  podcast_url: string | null
  vault_url: string | null
  tags: string[]
  year: number | null
  is_current: boolean
  leader: string | null
  study_guides: DbGuide[]
}

type DbGuide = {
  id: string
  slug: string
  label: string
  notion_url: string
  default_passage_ref: string | null
  content_md: string | null
  sort_order: number
}

function mapDbStudy(row: DbStudy): BibleStudy {
  const leader =
    row.leader === "mat" || row.leader === "jason" ? (row.leader as StudyLeader) : undefined
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    notionUrl: row.notion_url,
    summary: row.summary || "",
    guideLinks: (row.study_guides ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(
        (g): StudyGuideLink => ({
          label: g.label,
          url: g.notion_url || "",
          slug: g.slug,
          defaultPassageRef: g.default_passage_ref ?? undefined,
        })
      ),
    podcastUrl: row.podcast_url ?? undefined,
    vaultUrl: row.vault_url ?? undefined,
    tags: row.tags ?? [],
    year: row.year ?? undefined,
    leader,
  }
}

let cachedStudies: BibleStudy[] | null = null
let cachedCurrentId: string | null = null
let cacheTime = 0
const CACHE_TTL = 60_000

async function fetchStudiesFromDb(): Promise<{ studies: BibleStudy[]; currentId: string | null } | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null

  const now = Date.now()
  if (cachedStudies && now - cacheTime < CACHE_TTL) {
    return { studies: cachedStudies, currentId: cachedCurrentId }
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/bible_studies?select=*,study_guides(*)&order=sort_order.asc,created_at.desc`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        next: { revalidate: 60 },
      }
    )
    if (!res.ok) return null
    const rows: DbStudy[] = await res.json()
    if (!Array.isArray(rows) || rows.length === 0) return null

    const studies = rows.map(mapDbStudy)
    const current = rows.find((r) => r.is_current)
    cachedStudies = studies
    cachedCurrentId = current?.id ?? studies[0]?.id ?? null
    cacheTime = now
    return { studies, currentId: cachedCurrentId }
  } catch {
    return null
  }
}

export async function getStudiesFromDb() {
  return fetchStudiesFromDb()
}

/** Returns Mat's and Jason's studies for the two-card studies page. Mat fallback: is_current study. */
export async function getStudiesByLeaderAsync(): Promise<{
  matStudy: BibleStudy | null
  jasonStudy: BibleStudy | null
}> {
  const db = await fetchStudiesFromDb()
  if (!db || db.studies.length === 0) {
    return { matStudy: null, jasonStudy: null }
  }
  const matStudy =
    db.studies.find((s) => s.leader === "mat") ??
    db.studies.find((s) => s.id === db.currentId) ??
    db.studies[0] ??
    null
  const jasonStudy = db.studies.find((s) => s.leader === "jason") ?? null
  return { matStudy, jasonStudy }
}

export async function getGuideContentFromDb(
  studySlug: string,
  guideSlug: string
): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/study_guides?select=content_md,study:bible_studies!inner(slug)&study.slug=eq.${encodeURIComponent(studySlug)}&slug=eq.${encodeURIComponent(guideSlug)}&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        next: { revalidate: 60 },
      }
    )
    if (!res.ok) return null
    const rows = await res.json()
    if (!Array.isArray(rows) || rows.length === 0) return null
    return rows[0].content_md || null
  } catch {
    return null
  }
}
