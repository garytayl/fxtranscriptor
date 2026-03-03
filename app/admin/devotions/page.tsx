"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export type DevotionTopic = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  body: string | null;
  bible_references: string[];
  sort_order: number;
  published: boolean;
  created_at: string;
  updated_at: string;
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function AdminDevotionsPage() {
  const [topics, setTopics] = useState<DevotionTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<DevotionTopic | null>(null);
  const [showNew, setShowNew] = useState(false);

  const loadTopics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/devotions/topics", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load topics");
      const data = await res.json();
      setTopics(data.topics ?? []);
    } catch (err) {
      toast.error("Error loading topics", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.title.trim()) {
      toast.error("Title is required");
      return;
    }

    const slug = (editing.slug || slugify(editing.title)).trim() || slugify(editing.title);
    const payload = {
      title: editing.title.trim(),
      slug,
      description: editing.description?.trim() || null,
      body: editing.body?.trim() || null,
      bible_references: Array.isArray(editing.bible_references)
        ? editing.bible_references.filter((r) => String(r).trim())
        : [],
      sort_order: typeof editing.sort_order === "number" ? editing.sort_order : 0,
      published: !!editing.published,
    };

    setSaving(true);
    try {
      const isNew = !editing.id || editing.id.length < 10;
      const url = isNew
        ? "/api/admin/devotions/topics"
        : `/api/admin/devotions/topics/${editing.id}`;
      const method = isNew ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast.success(isNew ? "Topic created" : "Topic updated");
      setEditing(null);
      setShowNew(false);
      loadTopics();
    } catch (err) {
      toast.error("Save failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this topic? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/admin/devotions/topics/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Topic deleted");
      loadTopics();
    } catch (err) {
      toast.error("Delete failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const isEditing = !!editing;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Devotions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Weekly topical studies (e.g. Immigration — What the Bible Says). Add and reorder topics; they appear under Devotions as &quot;Topical study&quot;.
          </p>
        </div>
        {!isEditing && (
          <Button
            onClick={() => {
              setEditing({
                id: "",
                title: "",
                slug: "",
                description: "",
                body: "",
                bible_references: [],
                sort_order: topics.length,
                published: true,
                created_at: "",
                updated_at: "",
              });
              setShowNew(true);
            }}
            className="gap-2 font-mono text-xs uppercase tracking-widest"
          >
            <Plus className="size-4" />
            New Topic
          </Button>
        )}
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground font-mono">Loading topics…</div>
      )}

      {!isEditing && !loading && (
        <div className="space-y-3">
          {topics.length === 0 && (
            <div className="rounded-lg border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
              No topics yet. Click &quot;New Topic&quot; to add a weekly topical study (e.g. Immigration, Justice).
            </div>
          )}
          {topics.map((topic) => (
            <div
              key={topic.id}
              className="rounded-lg border border-border bg-card/60 p-4 flex items-start justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-foreground">{topic.title}</h3>
                  {!topic.published && (
                    <span className="text-[10px] font-mono uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                      Draft
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-mono">/{topic.slug}</p>
                {topic.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {topic.description}
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs uppercase tracking-widest"
                  onClick={() => setEditing({ ...topic })}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(topic.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isEditing && editing && (
        <div className="rounded-lg border border-border bg-card/60 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {showNew ? "New Topic" : `Editing: ${editing.title}`}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => { setEditing(null); setShowNew(false); }}>
              Cancel
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                Title *
              </label>
              <Input
                value={editing.title}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    title: e.target.value,
                    slug: editing.slug || slugify(e.target.value),
                  })
                }
                placeholder='e.g. Immigration — What the Bible Says'
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                Slug
              </label>
              <Input
                value={editing.slug}
                onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                placeholder="auto from title"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                Sort order
              </label>
              <Input
                type="number"
                value={editing.sort_order}
                onChange={(e) =>
                  setEditing({ ...editing, sort_order: parseInt(e.target.value, 10) || 0 })
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                Short description
              </label>
              <Input
                value={editing.description ?? ""}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                placeholder="One line for the topic list"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                Bible references (comma-separated)
              </label>
              <Input
                value={(editing.bible_references ?? []).join(", ")}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    bible_references: e.target.value
                      .split(",")
                      .map((r) => r.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Exodus 22:21, Leviticus 19:34, Matthew 25:35"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                Body (Markdown)
              </label>
              <textarea
                value={editing.body ?? ""}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                rows={14}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                placeholder="## Overview\n\nWhat does the Bible say about this topic?\n\n## Key passages\n\n..."
              />
            </div>
            <div className="flex items-center gap-3 pt-2 sm:col-span-2">
              <input
                type="checkbox"
                id="published"
                checked={editing.published}
                onChange={(e) => setEditing({ ...editing, published: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="published" className="text-sm text-foreground">
                Published (visible in Devotions)
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="ghost" onClick={() => { setEditing(null); setShowNew(false); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 font-mono text-xs uppercase tracking-widest">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {saving ? "Saving…" : showNew ? "Create Topic" : "Save Changes"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
