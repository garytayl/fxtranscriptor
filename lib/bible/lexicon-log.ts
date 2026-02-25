/**
 * Structured logging for Greek/Hebrew lexicon (Strong's).
 * Use when debugging "Definition not available" or CDN/fetch issues.
 * Logs appear in server stdout (e.g. Vercel function logs, local dev).
 */

const PREFIX = "[lexicon]"

function formatErr(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`
  return String(e)
}

export const lexiconLog = {
  /** OpenScriptures fetch attempted (per URL). */
  fetchAttempt(url: string): void {
    console.info(`${PREFIX} fetch attempt: ${url}`)
  },

  /** OpenScriptures fetch failed for a URL. */
  fetchFail(url: string, error: unknown): void {
    console.error(`${PREFIX} fetch failed: ${url}`, formatErr(error))
  },

  /** All fetch URLs failed for a dictionary. */
  fetchAllFailed(path: string, lastError: unknown): void {
    console.error(`${PREFIX} all sources failed for ${path}`, formatErr(lastError))
  },

  /** Response body could not be parsed as JSON / no object found. */
  parseFail(path: string, error: unknown): void {
    console.error(`${PREFIX} parse failed for ${path}`, formatErr(error))
  },

  /** Dictionary loaded successfully (first time). */
  dictLoaded(lang: "greek" | "hebrew", keyCount: number, source: string): void {
    console.info(`${PREFIX} ${lang} dictionary loaded: ${keyCount} entries (${source})`)
  },

  /** Code not present in dictionary after successful load. */
  codeNotFound(code: string, lang: "greek" | "hebrew"): void {
    console.warn(`${PREFIX} code not in dictionary: ${code} (${lang})`)
  },

  /** Lookup failed (exception). */
  lookupError(code: string, error: unknown): void {
    console.error(`${PREFIX} lookup error for ${code}`, formatErr(error))
  },

  /** API returning stub because entry was null. */
  apiStub(code: string): void {
    console.warn(`${PREFIX} API returning stub for ${code} (entry not found)`)
  },

  /** Invalid or unparseable code. */
  invalidCode(code: string): void {
    console.warn(`${PREFIX} invalid code: ${code}`)
  },
}
