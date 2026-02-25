import { getStudyBySlug } from "./studies"
import fs from "fs"
import path from "path"

/**
 * Read markdown content for a study guide from content/studies/{studySlug}/{guideSlug}.md.
 * Returns null if file doesn't exist.
 */
export async function getGuideContent(
  studySlug: string,
  guideSlug: string
): Promise<string | null> {
  const study = getStudyBySlug(studySlug)
  if (!study) return null

  const guide = study.guideLinks.find((g) => g.slug === guideSlug)
  if (!guide) return null

  const filePath = path.join(
    process.cwd(),
    "content",
    "studies",
    studySlug,
    `${guideSlug}.md`
  )

  try {
    const raw = await fs.promises.readFile(filePath, "utf-8")
    return raw
  } catch {
    return null
  }
}
