"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  getDevotionsFromStorage,
  saveDevotionsToStorage,
  createEntry,
  type DevotionEntry,
  type DevotionsData,
} from "@/lib/devotions-storage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Download, Upload, Plus, Trash2, Edit2, FileText } from "lucide-react"
import { toast } from "sonner"

function sortByNewest(entries: DevotionEntry[]) {
  return [...entries].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
}

export function DevotionsClient() {
  const [data, setData] = useState<DevotionsData | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [draftTitle, setDraftTitle] = useState("")
  const [draftBody, setDraftBody] = useState("")

  const load = useCallback(() => {
    setData(getDevotionsFromStorage())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const persist = useCallback((next: DevotionsData) => {
    saveDevotionsToStorage(next)
    setData(next)
  }, [])

  const handleAdd = () => {
    const title = draftTitle.trim() || "Untitled"
    const body = draftBody.trim()
    const entry = createEntry({ title, body })
    const next: DevotionsData = {
      version: 1,
      entries: [entry, ...(data?.entries ?? [])],
    }
    persist(next)
    setDraftTitle("")
    setDraftBody("")
    setIsAdding(false)
    toast.success("Saved", { description: "Devotion saved to this device." })
  }

  const handleUpdate = (id: string, updates: { title?: string; body?: string }) => {
    if (!data) return
    const next: DevotionsData = {
      ...data,
      entries: data.entries.map((e) =>
        e.id === id ? { ...e, ...updates } : e,
      ),
    }
    persist(next)
    setEditingId(null)
    toast.success("Updated", { description: "Changes saved locally." })
  }

  const handleDelete = (id: string) => {
    if (!data) return
    if (typeof window !== "undefined" && !window.confirm("Delete this devotion? This can't be undone.")) return
    const next: DevotionsData = {
      ...data,
      entries: data.entries.filter((e) => e.id !== id),
    }
    persist(next)
    setEditingId(null)
    toast.success("Deleted", { description: "Removed from this device." })
  }

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data ?? { version: 1, entries: [] }, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `fx-devotions-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Backup downloaded", { description: "Save the file somewhere safe to restore later." })
  }

  const handleImport = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "application/json"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string) as DevotionsData
          if (parsed?.version === 1 && Array.isArray(parsed.entries)) {
            persist(parsed)
            toast.success("Restored", { description: "Backup imported. Your devotions are updated." })
          } else {
            toast.error("Invalid file", { description: "Not a valid devotions backup." })
          }
        } catch {
          toast.error("Invalid file", { description: "Could not read the file." })
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  if (data === null) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <p className="font-mono text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  const entries = sortByNewest(data.entries)

  return (
    <main className="relative min-h-screen">
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
      <div className="relative z-10 pt-[var(--navbar-offset)] pb-24 px-4 sm:px-6 md:px-12">
        <header className="max-w-3xl mb-8 sm:mb-12 md:mb-16">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent transition-colors mb-4 sm:mb-6 min-h-[44px] sm:min-h-0"
          >
            ← Back to home
          </Link>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent mb-2">Devotions</p>
          <h1 className="font-[var(--font-bebas)] text-3xl sm:text-4xl md:text-6xl tracking-tight">
            Your devotions
          </h1>
          <p className="mt-3 sm:mt-4 font-mono text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xl">
            Private notes and reflections. Stored only on this device — no sign-in. Export a backup anytime so nothing gets lost.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
              <Download className="size-3.5" />
              Export backup
            </Button>
            <Button variant="ghost" size="sm" onClick={handleImport} className="gap-1.5">
              <Upload className="size-3.5" />
              Restore from file
            </Button>
          </div>
        </header>

        <section className="max-w-3xl space-y-6">
          {!isAdding ? (
            <Button variant="outline" onClick={() => setIsAdding(true)} className="gap-2">
              <Plus className="size-4" />
              New devotion
            </Button>
          ) : (
            <Card className="border-border bg-card/50">
              <CardHeader className="pb-2">
                <Input
                  placeholder="Title (optional)"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className="font-medium"
                />
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  placeholder="Write your reflection…"
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  rows={6}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAdd}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setIsAdding(false); setDraftTitle(""); setDraftBody(""); }}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {entries.length === 0 && !isAdding ? (
            <div className="border border-dashed border-border rounded-lg p-8 text-center">
              <FileText className="size-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="font-mono text-sm text-muted-foreground">No devotions yet. Add one above.</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {entries.map((entry) => (
                <li key={entry.id}>
                  {editingId === entry.id ? (
                    <DevotionEditCard
                      entry={entry}
                      onSave={(title, body) => handleUpdate(entry.id, { title, body })}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <Card className="border-border bg-card/50 overflow-hidden">
                      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                        <div className="min-w-0">
                          <h2 className="font-semibold truncate">{entry.title || "Untitled"}</h2>
                          <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                            {new Date(entry.createdAt).toLocaleDateString(undefined, {
                              dateStyle: "medium",
                            })}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon-sm" onClick={() => setEditingId(entry.id)} aria-label="Edit">
                            <Edit2 className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDelete(entry.id)}
                            aria-label="Delete"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="font-mono text-sm text-muted-foreground whitespace-pre-wrap">{entry.body || "—"}</p>
                      </CardContent>
                    </Card>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}

function DevotionEditCard({
  entry,
  onSave,
  onCancel,
}: {
  entry: DevotionEntry
  onSave: (title: string, body: string) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(entry.title)
  const [body, setBody] = useState(entry.body)

  return (
    <Card className="border-border bg-card/50">
      <CardHeader className="pb-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="font-medium" />
      </CardHeader>
      <CardContent className="space-y-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onSave(title.trim() || "Untitled", body.trim())}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
