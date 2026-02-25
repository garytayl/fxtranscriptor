"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, Trash2, ChevronDown, ChevronUp, Save, Loader2, GripVertical, FileText, ClipboardPaste } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"
import { parsePastedWeekContent } from "@/lib/studies"

type Guide = {
  slug: string
  label: string
  notion_url: string
  default_passage_ref: string
  content_md: string
}

type Study = {
  id: string
  slug: string
  title: string
  notion_url: string
  summary: string
  podcast_url: string
  vault_url: string
  tags: string[]
  year: number | null
  is_current: boolean
  study_guides: Guide[]
}

const emptyGuide: Guide = {
  slug: "",
  label: "",
  notion_url: "",
  default_passage_ref: "",
  content_md: "",
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export default function AdminStudiesPage() {
  const [studies, setStudies] = useState<Study[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editStudy, setEditStudy] = useState<Study | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [expandedGuide, setExpandedGuide] = useState<number | null>(null)
  const [pasteDialogGuideIndex, setPasteDialogGuideIndex] = useState<number | null>(null)
  const [pasteText, setPasteText] = useState("")
  const [pasteAutofillOpen, setPasteAutofillOpen] = useState(false)
  const [pasteAutofillText, setPasteAutofillText] = useState("")

  const loadStudies = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/studies", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load studies")
      const data = await res.json()
      setStudies(data.studies ?? [])
    } catch (err) {
      toast.error("Error loading studies", { description: err instanceof Error ? err.message : "Unknown error" })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStudies() }, [loadStudies])

  const newStudy = (): Study => ({
    id: "",
    slug: "",
    title: "",
    notion_url: "",
    summary: "",
    podcast_url: "",
    vault_url: "",
    tags: [],
    year: new Date().getFullYear(),
    is_current: false,
    study_guides: [{ ...emptyGuide, slug: "wk-1", label: "Week 1" }],
  })

  const handleSave = async () => {
    if (!editStudy) return
    if (!editStudy.title.trim()) {
      toast.error("Title is required")
      return
    }

    const slug = editStudy.slug || slugify(editStudy.title)
    const payload = {
      title: editStudy.title,
      slug,
      notion_url: editStudy.notion_url,
      summary: editStudy.summary,
      podcast_url: editStudy.podcast_url || null,
      vault_url: editStudy.vault_url || null,
      tags: editStudy.tags,
      year: editStudy.year,
      is_current: editStudy.is_current,
      guides: editStudy.study_guides.map((g, i) => ({
        slug: g.slug || `wk-${i + 1}`,
        label: g.label || `Week ${i + 1}`,
        notion_url: g.notion_url,
        default_passage_ref: g.default_passage_ref || null,
        content_md: g.content_md || null,
      })),
    }

    setSaving(true)
    try {
      const isNew = !editStudy.id
      const url = isNew ? "/api/admin/studies" : `/api/admin/studies/${editStudy.id}`
      const method = isNew ? "POST" : "PATCH"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Save failed")
      }
      toast.success(isNew ? "Study created" : "Study updated")
      setEditStudy(null)
      setShowNew(false)
      loadStudies()
    } catch (err) {
      toast.error("Save failed", { description: err instanceof Error ? err.message : "Unknown error" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this study and all its guides? This cannot be undone.")) return
    try {
      const res = await fetch(`/api/admin/studies/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) throw new Error("Delete failed")
      toast.success("Study deleted")
      loadStudies()
    } catch (err) {
      toast.error("Delete failed", { description: err instanceof Error ? err.message : "Unknown error" })
    }
  }

  const updateGuide = (index: number, field: keyof Guide, value: string) => {
    if (!editStudy) return
    const guides = [...editStudy.study_guides]
    guides[index] = { ...guides[index], [field]: value }
    setEditStudy({ ...editStudy, study_guides: guides })
  }

  const addGuide = () => {
    if (!editStudy) return
    const n = editStudy.study_guides.length + 1
    setEditStudy({
      ...editStudy,
      study_guides: [...editStudy.study_guides, { ...emptyGuide, slug: `wk-${n}`, label: `Week ${n}` }],
    })
  }

  const removeGuide = (index: number) => {
    if (!editStudy) return
    const guides = editStudy.study_guides.filter((_, i) => i !== index)
    setEditStudy({ ...editStudy, study_guides: guides })
  }

  const handlePasteNotion = () => {
    if (pasteDialogGuideIndex === null || !editStudy) return
    const md = pasteText.trim()
    if (!md) return
    updateGuide(pasteDialogGuideIndex, "content_md", md)

    const titleMatch = md.match(/^#\s+(.+)$/m)
    if (titleMatch && !editStudy.study_guides[pasteDialogGuideIndex].label) {
      updateGuide(pasteDialogGuideIndex, "label", titleMatch[1].trim())
    }

    setPasteDialogGuideIndex(null)
    setPasteText("")
    toast.success("Content pasted")
  }

  const handlePasteAutofill = () => {
    const raw = pasteAutofillText.trim()
    if (!raw) return
    try {
      const parsed = parsePastedWeekContent(raw)
      const study: Study = {
        ...newStudy(),
        title: parsed.title,
        summary: parsed.summary,
        podcast_url: parsed.podcast_url,
        vault_url: parsed.vault_url,
        study_guides: [
          {
            ...emptyGuide,
            slug: "wk-1",
            label: parsed.guide_label,
            default_passage_ref: parsed.default_passage_ref,
            content_md: parsed.content_md,
          },
        ],
      }
      setEditStudy(study)
      setShowNew(true)
      setExpandedGuide(0)
      setPasteAutofillOpen(false)
      setPasteAutofillText("")
      toast.success("Form filled from paste. Review and save.")
    } catch (err) {
      toast.error("Could not parse paste", { description: err instanceof Error ? err.message : "Unknown error" })
    }
  }

  const isEditing = !!editStudy

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bible Studies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage study guides. Paste content directly from Notion.
          </p>
        </div>
        {!isEditing && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => { setPasteAutofillOpen(true); setPasteAutofillText("") }}
              className="gap-2 font-mono text-xs uppercase tracking-widest"
            >
              <ClipboardPaste className="size-4" />
              Paste to autofill
            </Button>
            <Button
              onClick={() => { setEditStudy(newStudy()); setShowNew(true); setExpandedGuide(0) }}
              className="gap-2 font-mono text-xs uppercase tracking-widest"
            >
              <Plus className="size-4" />
              New Study
            </Button>
          </div>
        )}
      </div>

      {loading && <div className="text-sm text-muted-foreground font-mono">Loading studies...</div>}

      {/* Study list */}
      {!isEditing && !loading && (
        <div className="space-y-3">
          {studies.length === 0 && (
            <div className="rounded-lg border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
              No studies in the database yet. Studies from the hardcoded config are still shown on the site.
              <br />Click "New Study" to create one, or paste content from Notion.
            </div>
          )}
          {studies.map((study) => (
            <div key={study.id} className="rounded-lg border border-border bg-card/60 p-4 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-foreground">{study.title}</h3>
                  {study.is_current && (
                    <span className="text-[10px] font-mono uppercase tracking-widest text-accent bg-accent/10 border border-accent/30 px-2 py-0.5 rounded">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-mono">/{study.slug}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {study.study_guides?.length ?? 0} guide{(study.study_guides?.length ?? 0) === 1 ? "" : "s"}
                  {study.year ? ` · ${study.year}` : ""}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs uppercase tracking-widest"
                  onClick={() => {
                    setEditStudy({
                      ...study,
                      podcast_url: study.podcast_url ?? "",
                      vault_url: study.vault_url ?? "",
                      study_guides: (study.study_guides ?? []).map((g) => ({
                        ...g,
                        notion_url: g.notion_url ?? "",
                        default_passage_ref: g.default_passage_ref ?? "",
                        content_md: g.content_md ?? "",
                      })),
                    })
                    setExpandedGuide(null)
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(study.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit / New form */}
      {isEditing && editStudy && (
        <div className="rounded-lg border border-border bg-card/60 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{showNew ? "New Study" : `Editing: ${editStudy.title}`}</h2>
            <Button variant="ghost" size="sm" onClick={() => { setEditStudy(null); setShowNew(false) }}>
              Cancel
            </Button>
          </div>

          {/* Study metadata */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Title *</label>
              <Input
                value={editStudy.title}
                onChange={(e) => setEditStudy({ ...editStudy, title: e.target.value, slug: editStudy.slug || slugify(e.target.value) })}
                placeholder='e.g. "Jonah: GET UP! GO!"'
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Slug</label>
              <Input
                value={editStudy.slug}
                onChange={(e) => setEditStudy({ ...editStudy, slug: e.target.value })}
                placeholder="auto-generated from title"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Summary</label>
              <textarea
                value={editStudy.summary}
                onChange={(e) => setEditStudy({ ...editStudy, summary: e.target.value })}
                rows={3}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                placeholder="Brief description of the study..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Notion URL</label>
              <Input
                value={editStudy.notion_url}
                onChange={(e) => setEditStudy({ ...editStudy, notion_url: e.target.value })}
                placeholder="https://fxchurch.notion.site/..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Year</label>
              <Input
                type="number"
                value={editStudy.year ?? ""}
                onChange={(e) => setEditStudy({ ...editStudy, year: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Podcast URL</label>
              <Input
                value={editStudy.podcast_url}
                onChange={(e) => setEditStudy({ ...editStudy, podcast_url: e.target.value })}
                placeholder="https://fxtalk.podbean.com/..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Vault URL</label>
              <Input
                value={editStudy.vault_url}
                onChange={(e) => setEditStudy({ ...editStudy, vault_url: e.target.value })}
                placeholder="http://fxchur.ch/rgvault"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Tags (comma-separated)</label>
              <Input
                value={editStudy.tags.join(", ")}
                onChange={(e) => setEditStudy({ ...editStudy, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                placeholder="Jonah, 2026"
              />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <input
                type="checkbox"
                id="is-current"
                checked={editStudy.is_current}
                onChange={(e) => setEditStudy({ ...editStudy, is_current: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="is-current" className="text-sm text-foreground">Mark as current study</label>
            </div>
          </div>

          {/* Study guides (weeks) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold font-mono uppercase tracking-widest text-muted-foreground">
                Study Guides ({editStudy.study_guides.length})
              </h3>
              <Button variant="outline" size="sm" onClick={addGuide} className="gap-1.5 font-mono text-xs uppercase tracking-widest">
                <Plus className="size-3" />
                Add Week
              </Button>
            </div>

            {editStudy.study_guides.map((guide, i) => (
              <div key={i} className="rounded-lg border border-border bg-background/50">
                {/* Guide header — always visible */}
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
                  onClick={() => setExpandedGuide(expandedGuide === i ? null : i)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <GripVertical className="size-4 text-muted-foreground shrink-0" />
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium truncate">{guide.label || `Week ${i + 1}`}</span>
                    {guide.content_md && (
                      <FileText className="size-3.5 text-accent shrink-0" />
                    )}
                  </div>
                  {expandedGuide === i ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                </button>

                {/* Guide expanded form */}
                {expandedGuide === i && (
                  <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Label *</label>
                        <Input
                          value={guide.label}
                          onChange={(e) => updateGuide(i, "label", e.target.value)}
                          placeholder='e.g. "Wk 1: The Word Came"'
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Slug</label>
                        <Input
                          value={guide.slug}
                          onChange={(e) => updateGuide(i, "slug", e.target.value)}
                          placeholder={`wk-${i + 1}`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Notion URL</label>
                        <Input
                          value={guide.notion_url}
                          onChange={(e) => updateGuide(i, "notion_url", e.target.value)}
                          placeholder="https://www.notion.so/..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Default passage</label>
                        <Input
                          value={guide.default_passage_ref}
                          onChange={(e) => updateGuide(i, "default_passage_ref", e.target.value)}
                          placeholder='e.g. "Jonah 4:1-11"'
                        />
                      </div>
                    </div>

                    {/* Content area */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                          Guide content (Markdown)
                        </label>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 font-mono text-[10px] uppercase tracking-widest"
                          onClick={() => { setPasteDialogGuideIndex(i); setPasteText("") }}
                        >
                          <FileText className="size-3" />
                          Paste from Notion
                        </Button>
                      </div>
                      <textarea
                        value={guide.content_md}
                        onChange={(e) => updateGuide(i, "content_md", e.target.value)}
                        rows={12}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs font-mono shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 leading-relaxed"
                        placeholder={"# Wk 1: Title\n\n### Series Summary\n\n...\n\n## Starter\n\nQuestion here?\n\n## Study Questions\n\n1. First question\n2. Second question"}
                      />
                      {guide.content_md && (
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {guide.content_md.length.toLocaleString()} characters
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive gap-1.5 font-mono text-[10px] uppercase tracking-widest"
                        onClick={() => removeGuide(i)}
                      >
                        <Trash2 className="size-3" />
                        Remove week
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Save button */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button variant="ghost" onClick={() => { setEditStudy(null); setShowNew(false) }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 font-mono text-xs uppercase tracking-widest">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {saving ? "Saving..." : showNew ? "Create Study" : "Save Changes"}
            </Button>
          </div>
        </div>
      )}

      {/* Paste to autofill (full study/week) dialog */}
      <Dialog open={pasteAutofillOpen} onOpenChange={(open) => { if (!open) setPasteAutofillOpen(false) }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Paste to autofill</DialogTitle>
            <DialogDescription>
              Paste a full week or study (e.g. from Notion or email). We’ll pull out the series summary, podcast/vault links, first passage ref, and use the rest as the guide content. Then you can tweak and save.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={pasteAutofillText}
            onChange={(e) => setPasteAutofillText(e.target.value)}
            rows={20}
            className="flex-1 min-h-[320px] w-full rounded-md border border-border bg-background px-3 py-2 text-xs font-mono shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 leading-relaxed"
            placeholder="Paste the full study guide or week content here (e.g. Series Summary, Starter, Pray, Study Questions with READ: refs, podcast/vault links at the end)..."
            autoFocus
          />
          {pasteAutofillText && (
            <p className="text-[10px] text-muted-foreground font-mono">
              {pasteAutofillText.length.toLocaleString()} characters
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPasteAutofillOpen(false)}>Cancel</Button>
            <Button onClick={handlePasteAutofill} disabled={!pasteAutofillText.trim()} className="gap-2 font-mono text-xs uppercase tracking-widest">
              <ClipboardPaste className="size-4" />
              Autofill form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Paste from Notion dialog (single guide content) */}
      <Dialog open={pasteDialogGuideIndex !== null} onOpenChange={(open) => { if (!open) setPasteDialogGuideIndex(null) }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Paste from Notion</DialogTitle>
            <DialogDescription>
              Copy the entire study guide content from Notion and paste it below.
              It will be stored as Markdown and rendered with the same formatting as other guides.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={18}
            className="flex-1 min-h-[300px] w-full rounded-md border border-border bg-background px-3 py-2 text-xs font-mono shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 leading-relaxed"
            placeholder={"Paste the full study guide text from Notion here.\n\nThe text should include:\n- Title (# Wk 1: ...)\n- Series Summary\n- Starter question\n- Prayer\n- Study Questions with numbered items\n- READ: sections with verse references\n- Follow up items\n\nAll Notion formatting (bold, italic, links, lists) will be preserved."}
            autoFocus
          />
          {pasteText && (
            <p className="text-[10px] text-muted-foreground font-mono">
              {pasteText.length.toLocaleString()} characters pasted
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPasteDialogGuideIndex(null)}>Cancel</Button>
            <Button onClick={handlePasteNotion} disabled={!pasteText.trim()} className="gap-2 font-mono text-xs uppercase tracking-widest">
              <FileText className="size-4" />
              Use this content
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
