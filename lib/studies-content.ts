import { parsePassageReference, parsePassageList } from "@/lib/bible/reference"
import { getStudyBySlug } from "./studies"
import { getGuideContentFromDb } from "./studies-db"
import fs from "fs"
import path from "path"

/** Extract the first Bible passage ref from markdown (from [text](url) where text parses as a ref). */
export function getFirstPassageRefFromContent(content: string): string | null {
  if (!content) return null
  const linkRegex = /\[([^\]]+)\]\((https?:\S+)\)/g
  const match = linkRegex.exec(content)
  if (!match) return null
  const text = match[1].trim()
  const list = text.includes(",") ? parsePassageList(text) : null
  if (list && list.length > 0) return list[0].raw
  const single = parsePassageReference(text)
  return single ? single.raw : null
}

/** Allow only safe slug chars to prevent path traversal */
const SLUG_REGEX = /^[a-z0-9-]+$/

/**
 * Read markdown content for a study guide from content/studies/{studySlug}/{guideSlug}.md.
 * Returns null if file doesn't exist or path is invalid.
 */
export async function getGuideContent(
  studySlug: string,
  guideSlug: string
): Promise<string | null> {
  if (!studySlug || !guideSlug || !SLUG_REGEX.test(studySlug) || !SLUG_REGEX.test(guideSlug)) {
    return null
  }

  const dbContent = await getGuideContentFromDb(studySlug, guideSlug)
  if (dbContent) return dbContent

  const study = getStudyBySlug(studySlug)
  if (!study) return null

  const guide = study.guideLinks.find((g) => g.slug === guideSlug)
  if (!guide) return null

  try {
    const filePath = path.join(
      process.cwd(),
      "content",
      "studies",
      studySlug,
      `${guideSlug}.md`
    )
    const raw = await fs.promises.readFile(filePath, "utf-8")
    return raw
  } catch {
    return null
  }
}
