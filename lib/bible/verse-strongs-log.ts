/**
 * Server-side logs for KJV / Kaiserlik Strong's loading (verse-strongs.ts).
 * Appears in: local terminal (npm run dev), Vercel → Deployment → Functions / Runtime logs.
 */

const PREFIX = "[strongs]"

function formatErr(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`
  return String(e)
}

export const verseStrongsLog = {
  resolveStart(book: { slug: string; id: string }, chapter: number): void {
    console.info(`${PREFIX} load chapter: bookSlug=${JSON.stringify(book.slug)} apiBookId=${JSON.stringify(book.id)} chapter=${chapter}`)
  },

  resolved(code: string | null, via: "slug" | "usfm_full" | "usfm_segment" | "none"): void {
    if (code) {
      console.info(`${PREFIX} kaiserlik file stem: ${code} (via ${via})`)
    } else {
      console.warn(
        `${PREFIX} could not resolve kaiserlik stem — slug not in map and USFM id did not match (see SLUG_TO_KJV_CODE / USFM_TO_KAISERLIK in verse-strongs.ts)`,
      )
    }
  },

  fetchAttempt(url: string): void {
    console.info(`${PREFIX} GET ${url}`)
  },

  fetchResponse(url: string, status: number, ok: boolean): void {
    const level = ok ? console.info : console.warn
    level.call(console, `${PREFIX} response: ${status} ${ok ? "ok" : "failed"} — ${url}`)
  },

  fetchThrow(url: string, error: unknown): void {
    console.error(`${PREFIX} fetch threw for ${url}`, formatErr(error))
  },

  fetchExhausted(urlsTried: string[], lastStatus: number | null): void {
    console.error(
      `${PREFIX} all Kaiserlik URLs failed or returned non-OK (lastStatus=${lastStatus}). Tried:\n  ${urlsTried.join("\n  ")}`,
    )
  },

  jsonParsed(kaiserlikCode: string, topLevelKeys: string[]): void {
    console.info(`${PREFIX} JSON parsed for ${kaiserlikCode}.json; top-level keys: ${topLevelKeys.join(", ")}`)
  },

  jsonParseError(url: string, error: unknown): void {
    console.error(`${PREFIX} JSON parse error for ${url}`, formatErr(error))
  },

  bookDataMissing(kaiserlikCode: string, topLevelKeys: string[]): void {
    console.error(`${PREFIX} getBookData empty or invalid after parse (code=${kaiserlikCode}, keys=${topLevelKeys.join(",")})`)
  },

  chapterLookup(kaiserlikCode: string, chapter: number, chapterKey: string, found: boolean, sampleChapterKeys: string[]): void {
    if (found) {
      console.info(`${PREFIX} chapter container found: ${chapterKey}`)
    } else {
      console.warn(
        `${PREFIX} no chapter key "${chapterKey}" in Kaiserlik data. Sample keys: ${sampleChapterKeys.slice(0, 8).join(", ") || "(none)"}`,
      )
    }
  },

  versesLoaded(verseCount: number): void {
    console.info(`${PREFIX} parsed ${verseCount} verses with Strong's pairs`)
  },

  skipped(reason: string): void {
    console.info(`${PREFIX} skipped: ${reason}`)
  },
}

export function isVerseStrongsDebugUiEnabled(): boolean {
  const v = process.env.BIBLE_STRONGS_DEBUG
  return v === "1" || v === "true"
}
