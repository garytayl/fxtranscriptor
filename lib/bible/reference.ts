export type VerseRange = {
  start: number
  end: number
}

export function slugifyBookName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function parseVerseRange(raw?: string | null): VerseRange | null {
  if (!raw) {
    return null
  }

  const normalized = raw.trim()
  if (!normalized) {
    return null
  }

  const match = normalized.match(/^(\d+)(?:-(\d+))?$/)
  if (!match) {
    return null
  }

  const start = Number.parseInt(match[1], 10)
  const end = Number.parseInt(match[2] ?? match[1], 10)

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null
  }
  if (start <= 0 || end <= 0 || end < start) {
    return null
  }

  return { start, end }
}

export function isVerseInRange(verseNumber: number, range: VerseRange | null): boolean {
  if (!range) {
    return false
  }
  return verseNumber >= range.start && verseNumber <= range.end
}
