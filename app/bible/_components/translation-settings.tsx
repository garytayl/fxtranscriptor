"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Settings2 } from "lucide-react"

import type { BibleTranslation } from "@/lib/bible/translations"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const STORAGE_KEY = "fx_bible_translation"

type TranslationSettingsProps = {
  translations: BibleTranslation[]
  currentKey: string | null
}

export function TranslationSettings({ translations, currentKey }: TranslationSettingsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(currentKey ?? translations[0]?.key ?? "")

  const currentLabel = useMemo(() => {
    if (!translations.length) {
      return "Default"
    }
    const match = translations.find((translation) => translation.key === (currentKey ?? selected))
    return match?.label ?? translations[0]?.label ?? "Default"
  }, [translations, currentKey, selected])

  useEffect(() => {
    if (!currentKey && translations.length > 0) {
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null
      if (stored && stored !== currentKey) {
        const params = new URLSearchParams(searchParams)
        params.set("t", stored)
        router.replace(`${pathname}?${params.toString()}`)
        setSelected(stored)
      }
    }
  }, [currentKey, pathname, router, searchParams, translations.length])

  useEffect(() => {
    if (currentKey) {
      setSelected(currentKey)
    }
  }, [currentKey])

  const handleChange = (value: string) => {
    setSelected(value)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, value)
    }
    const params = new URLSearchParams(searchParams)
    params.set("t", value)
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Translation: {currentLabel}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2 text-xs uppercase tracking-[0.2em]"
        onClick={() => setOpen(true)}
      >
        <Settings2 className="size-3.5" />
        Settings
      </Button>
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
              {translations.map((translation) => (
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
