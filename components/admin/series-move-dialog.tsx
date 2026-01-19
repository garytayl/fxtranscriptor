"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SeriesMoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sermonCount: number;
  seriesOptions: string[];
  defaultSeries?: string | null;
  onSave: (seriesOverride: string | null) => Promise<void>;
}

export function SeriesMoveDialog({
  open,
  onOpenChange,
  sermonCount,
  seriesOptions,
  defaultSeries,
  onSave,
}: SeriesMoveDialogProps) {
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [customSeries, setCustomSeries] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedOption("");
      setCustomSeries("");
      setError(null);
      setSaving(false);
      return;
    }

    if (defaultSeries) {
      setSelectedOption(defaultSeries);
    }
  }, [defaultSeries, open]);

  const resolvedSeries = customSeries.trim() || selectedOption.trim();

  const handleSave = async () => {
    if (!resolvedSeries) {
      setError("Choose a series or enter a new name.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(resolvedSeries);
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to move sermons.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(null);
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to clear override.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move Sermons to Series</DialogTitle>
          <DialogDescription>
            Updating {sermonCount} sermon{sermonCount === 1 ? "" : "s"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Existing series
            </label>
            <Select value={selectedOption} onValueChange={setSelectedOption}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select series" />
              </SelectTrigger>
              <SelectContent>
                {seriesOptions.length === 0 && (
                  <SelectItem value="__empty" disabled>
                    No series found
                  </SelectItem>
                )}
                {seriesOptions.map((series) => (
                  <SelectItem key={series} value={series}>
                    {series}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Or create a new series
            </label>
            <Input
              value={customSeries}
              onChange={(event) => setCustomSeries(event.target.value)}
              placeholder="New series name"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClear} disabled={saving}>
            Clear Override
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

