"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"

import type { BibleTranslation } from "@/lib/bible/translations"

type TranslationSelectProps = {
  translations: BibleTranslation[]
  currentKey: string | null
}

export function TranslationSelect({ translations, currentKey }: TranslationSelectProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (translations.length <= 1) {
    return (
      <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Translation: {translations[0]?.label ?? "Default"}
      </div>
    )
  }

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams)
    params.set("t", event.target.value)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-col gap-1 text-left">
      <label htmlFor="translation-select" className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        Translation
      </label>
      <select
        id="translation-select"
        value={currentKey ?? translations[0]?.key}
        onChange={handleChange}
        className="h-10 min-w-[160px] rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        {translations.map((translation) => (
          <option key={translation.key} value={translation.key}>
            {translation.label}
          </option>
        ))}
      </select>
    </div>
  )
}
