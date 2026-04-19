import type { EndingsQuest } from "@/lib/greek-endings-quest-data"

function stableHash(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function buildEndingsQuestKey(sectionId: string, idx: number): string {
  return `${sectionId}-${idx}-${stableHash(`${sectionId}:${idx}`)}`
}

function normalizeUniqueOptions(options: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const option of options) {
    if (!option || seen.has(option)) continue
    seen.add(option)
    out.push(option)
  }
  return out
}

export function buildEndingsQuestChoices(quest: EndingsQuest): string[] {
  const options = normalizeUniqueOptions([quest.answer, ...quest.distractors]).slice(0, 4)
  const seed = stableHash(quest.id)
  for (let i = options.length - 1; i > 0; i--) {
    const j = seed % (i + 1)
    ;[options[i], options[j]] = [options[j], options[i]!]
  }
  return options
}
