"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Settings2 } from "lucide-react"

import type { BibleTranslation } from "@/lib/bible/translations"
import { withFxGreekTranslation } from "@/lib/bible/with-fx-greek-translation"
import {
  BIBLE_TRANSLATION_CHANGED_EVENT,
  BIBLE_TRANSLATION_STORAGE_KEY,
} from "@/lib/bible/translation-storage"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type TranslationSettingsProps = {
  translations: BibleTranslation[]
  currentKey: string | null
}

export function TranslationSettings({ translations, currentKey }: TranslationSettingsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const translationOptions = useMemo(() => withFxGreekTranslation(translations), [translations])
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(currentKey ?? translationOptions[0]?.key ?? "")

  const currentLabel = useMemo(() => {
    if (!translationOptions.length) {
      return "Default"
    }
    const match = translationOptions.find((translation) => translation.key === (currentKey ?? selected))
    return match?.label ?? translationOptions[0]?.label ?? "Default"
  }, [translationOptions, currentKey, selected])

  useEffect(() => {
    if (!currentKey && translationOptions.length > 0) {
      const stored =
        typeof window !== "undefined" ? window.localStorage.getItem(BIBLE_TRANSLATION_STORAGE_KEY) : null
      if (stored && stored !== currentKey) {
        const params = new URLSearchParams(searchParams)
        params.set("t", stored)
        router.replace(`${pathname}?${params.toString()}`)
        setSelected(stored)
      }
    }
  }, [currentKey, pathname, router, searchParams, translationOptions.length])

  useEffect(() => {
    if (currentKey) {
      setSelected(currentKey)
    }
  }, [currentKey])

  const handleChange = (value: string) => {
    setSelected(value)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(BIBLE_TRANSLATION_STORAGE_KEY, value)
      window.dispatchEvent(new Event(BIBLE_TRANSLATION_CHANGED_EVENT))
    }
    const params = new URLSearchParams(searchParams)
    params.set("t", value)
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em] text-muted-foreground hover:text-accent transition-colors min-w-0"
      >
        <Settings2 className="size-3 sm:size-3.5 shrink-0" />
        <span className="truncate max-w-[120px] sm:max-w-none">{currentLabel}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Translation Settings</DialogTitle>
            <DialogDescription>
              Choose the Bible translation for the scripture reader.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label
              htmlFor="translation-settings-select"
              className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground"
            >
              Translation
            </label>
            <select
              id="translation-settings-select"
              value={selected}
              onChange={(event) => handleChange(event.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              {translationOptions.map((translation) => (
                <option key={translation.key} value={translation.key}>
                  {translation.label}
                </option>
              ))}
            </select>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
