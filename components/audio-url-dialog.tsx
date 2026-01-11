"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Link2, Save, Loader2, X } from "lucide-react";
import { Sermon } from "@/lib/supabase";

interface AudioUrlDialogProps {
  sermon: Sermon | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (sermon: Sermon, audioUrl: string, podbeanUrl?: string) => Promise<void>;
}

export function AudioUrlDialog({ sermon, open, onOpenChange, onSave }: AudioUrlDialogProps) {
  const [audioUrl, setAudioUrl] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset when dialog opens/closes or sermon changes
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && sermon) {
      setAudioUrl(sermon.audio_url || "");
    } else {
      setAudioUrl("");
    }
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    if (!sermon || !audioUrl.trim()) {
      alert("Please enter an audio URL or Podbean episode URL");
      return;
    }

    // Check if it's a Podbean URL or direct audio URL
    const isPodbeanUrl = audioUrl.includes("podbean.com");
    const isDirectAudio = /\.(mp3|m4a|wav|ogg)(\?|$)/i.test(audioUrl);

    if (!isPodbeanUrl && !isDirectAudio) {
      if (!confirm("This doesn't look like a Podbean URL or direct audio URL. Continue anyway?")) {
        return;
      }
    }

    try {
      setSaving(true);
      await onSave(
        sermon,
        isDirectAudio ? audioUrl : "",
        isPodbeanUrl ? audioUrl : undefined
      );
      handleOpenChange(false);
    } catch (error) {
      console.error("Error saving audio URL:", error);
    } finally {
      setSaving(false);
    }
  };

  if (!sermon) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono uppercase tracking-widest text-sm">
            {sermon.audio_url ? "Update Audio URL" : "Set Audio URL"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {sermon.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2 block">
              Audio URL or Podbean Episode URL
            </label>
            <Input
              type="url"
              placeholder="https://... (MP3/M4A URL or Podbean episode URL)"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              className="font-mono text-xs"
              disabled={saving}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !saving) {
                  handleSave();
                }
              }}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Paste either: (1) Direct MP3/M4A URL, or (2) Podbean episode URL (we'll extract the audio URL)
            </p>
          </div>

          {sermon.audio_url && (
            <div className="p-3 border rounded-lg bg-muted/50">
              <p className="text-xs font-mono text-muted-foreground">
                Current: <span className="text-foreground/70 break-all">{sermon.audio_url.substring(0, 100)}{sermon.audio_url.length > 100 ? '...' : ''}</span>
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-xs uppercase tracking-widest"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="font-mono text-xs uppercase tracking-widest"
            onClick={handleSave}
            disabled={saving || !audioUrl.trim()}
          >
            {saving ? (
              <>
                <Loader2 className="size-3 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-3 mr-2" />
                Save Audio URL
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
