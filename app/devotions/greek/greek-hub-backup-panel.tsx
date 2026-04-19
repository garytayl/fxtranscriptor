"use client"

import { useCallback, useRef, useState, type ChangeEvent } from "react"
import { Download, Trash2, Upload } from "lucide-react"

import {
  applyGreekBackupPayload,
  clearAllGreekStudyStorage,
  downloadGreekBackupJson,
  parseGreekBackupPayload,
} from "@/lib/devotions-greek-backup"
import { cn } from "@/lib/utils"

export function GreekHubBackupPanel({
  className,
  onBackupApplied,
}: {
  className?: string
  /** Called after import or reset so the hub refreshes. */
  onBackupApplied?: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importOk, setImportOk] = useState(false)

  const handleExport = useCallback(() => {
    setImportError(null)
    setImportOk(false)
    downloadGreekBackupJson()
  }, [])

  const handleFile = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ""
      if (!file) return
      setImportError(null)
      setImportOk(false)
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const text = typeof reader.result === "string" ? reader.result : ""
          const parsed = JSON.parse(text) as unknown
          const payload = parseGreekBackupPayload(parsed)
          if (!payload) {
            setImportError("This file is not a valid Greek study backup (v1 or v2).")
            return
          }
          applyGreekBackupPayload(payload)
          setImportOk(true)
          onBackupApplied?.()
        } catch {
          setImportError("Could not read this JSON file.")
        }
      }
      reader.readAsText(file)
    },
    [onBackupApplied],
  )

  const handleReset = useCallback(() => {
    if (
      !window.confirm(
        "Clear all Greek study data on this device? Progress, place, word memory, preferences, endings lab, daily run, and verse-quest reading track will be removed. This cannot be undone.",
      )
    ) {
      return
    }
    clearAllGreekStudyStorage()
    setImportError(null)
    setImportOk(false)
    onBackupApplied?.()
  }, [onBackupApplied])

  return (
    <section
      className={cn(
        "rounded-2xl border border-white/10 bg-black/20 px-4 py-4 sm:px-5",
        className,
      )}
      aria-label="Backup and reset"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">Data</p>
      <p className="mt-1 text-xs leading-relaxed text-white/65">
        Export a JSON backup of your Greek progress, or restore from a file. Reset clears local data on this browser
        only.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-medium text-white/90 hover:bg-white/[0.1]"
        >
          <Download className="size-3.5" aria-hidden />
          Export JSON
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-medium text-white/90 hover:bg-white/[0.1]"
        >
          <Upload className="size-3.5" aria-hidden />
          Import
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFile} />
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-2 rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200/95 hover:bg-red-500/18"
        >
          <Trash2 className="size-3.5" aria-hidden />
          Reset all
        </button>
      </div>
      {importError ? <p className="mt-3 text-xs text-amber-200/90">{importError}</p> : null}
      {importOk ? <p className="mt-3 text-xs text-emerald-300/90">Backup imported. Refresh if something looks stale.</p> : null}
    </section>
  )
}
