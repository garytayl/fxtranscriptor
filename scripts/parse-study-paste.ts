#!/usr/bin/env npx tsx
/**
 * Parse pasted Notion study text into a study object you can add to lib/studies.ts
 *
 * Usage:
 *   1. Copy the study page text from Notion (title, summary, study guides, podcast/vault links).
 *   2. Run: pnpm exec tsx scripts/parse-study-paste.ts
 *   3. Paste the text, then press Ctrl+D (Unix) or Ctrl+Z then Enter (Windows).
 *   Or pass a file: pnpm exec tsx scripts/parse-study-paste.ts path/to/paste.txt
 *
 * Then add the printed object to STUDIES in lib/studies.ts and set CURRENT_STUDY_ID if it's the new current study.
 */

import { parseStudyFromNotionPaste } from "../lib/studies"

async function main() {
  let input: string
  const file = process.argv[2]
  if (file) {
    const fs = await import("fs")
    input = fs.readFileSync(file, "utf-8")
  } else {
    process.stderr.write("Paste Notion study text below, then Ctrl+D (or Ctrl+Z+Enter on Windows):\n\n")
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    input = Buffer.concat(chunks).toString("utf-8")
  }

  const parsed = parseStudyFromNotionPaste(input)
  const slug =
    parsed.title
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") ?? "new-study"
  const id = `${slug}-${new Date().getFullYear()}`

  const study = {
    id,
    slug,
    title: parsed.title,
    notionUrl: parsed.notionUrl,
    summary: parsed.summary,
    guideLinks: parsed.guideLinks ?? [],
    podcastUrl: parsed.podcastUrl,
    vaultUrl: parsed.vaultUrl,
    tags: parsed.title ? [parsed.title.split(":")[0]?.trim() ?? "", String(new Date().getFullYear())] : [],
    year: new Date().getFullYear(),
  }

  console.log(JSON.stringify(study, null, 2))
  process.stderr.write("\nAdd the above to STUDIES in lib/studies.ts.\n")
  process.stderr.write("If the main study page URL (notionUrl) should be the fxchurch.notion.site overview page, paste that URL over notionUrl.\n")
  process.stderr.write('Set CURRENT_STUDY_ID to "' + id + '" if this is the current study.\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
