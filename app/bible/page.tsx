import { Suspense } from "react"

import { BiblePickerClient } from "@/app/bible/_components/bible-picker-client"
import { getResolvedTranslations, getResolvedTranslationByKey } from "@/lib/bible/translations"

export const revalidate = 3600

export default async function BibleIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[] }>
}) {
  const resolved = await searchParams
  const translationKey = Array.isArray(resolved.t) ? resolved.t[0] : resolved.t
  const translations = await getResolvedTranslations()
  const translation = await getResolvedTranslationByKey(translationKey ?? null)
  const activeKey = translation?.key ?? translationKey ?? null

  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background pt-[var(--navbar-offset)] flex items-center justify-center">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Loading…</p>
        </main>
      }
    >
      <BiblePickerClient translations={translations} currentKey={activeKey} />
    </Suspense>
  )
}
