"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SeriesMoveDialog } from "@/components/admin/series-move-dialog";
import type { Sermon } from "@/lib/supabase";

type StatusFilter = "all" | "pending" | "generating" | "completed" | "failed";

export function SermonSeriesManager() {
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [seriesOptions, setSeriesOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [seriesFilter, setSeriesFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogIds, setDialogIds] = useState<string[]>([]);
  const [dialogDefaultSeries, setDialogDefaultSeries] = useState<string | null>(null);

  const loadSermons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/catalog/list");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load sermons.");
      }
      setSermons(data.sermons ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load sermons.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSeriesOptions = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/sermons/series-options");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load series options.");
      }
      setSeriesOptions(data.seriesOptions ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load series options.";
      toast.error("Series Options Error", { description: message });
    }
  }, []);

  useEffect(() => {
    loadSermons();
    loadSeriesOptions();
  }, [loadSermons, loadSeriesOptions]);

  const filteredSermons = useMemo(() => {
    return sermons.filter((sermon) => {
      const query = searchQuery.trim().toLowerCase();
      const effectiveSeries = sermon.series_override || sermon.series || "";
      const matchesQuery =
        !query ||
        sermon.title.toLowerCase().includes(query) ||
        sermon.description?.toLowerCase().includes(query) ||
        sermon.speaker?.toLowerCase().includes(query) ||
        effectiveSeries.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" || sermon.status === statusFilter;

      const matchesSeries =
        seriesFilter === "all" || effectiveSeries === seriesFilter;

      return matchesQuery && matchesStatus && matchesSeries;
    });
  }, [sermons, searchQuery, statusFilter, seriesFilter]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSermons.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filteredSermons.map((sermon) => sermon.id)));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openMoveDialog = (ids: string[]) => {
    setDialogIds(ids);
    const first = sermons.find((sermon) => sermon.id === ids[0]);
    const defaultSeries = first?.series_override || first?.series || null;
    setDialogDefaultSeries(defaultSeries);
    setDialogOpen(true);
  };

  const handleMoveSeries = async (seriesOverride: string | null) => {
    const response = await fetch("/api/admin/sermons/series", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sermonIds: dialogIds,
        seriesOverride,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to update series.");
    }

    setSermons((prev) =>
      prev.map((sermon) =>
        dialogIds.includes(sermon.id)
          ? { ...sermon, series_override: seriesOverride }
          : sermon
      )
    );
    setSelectedIds(new Set());
    await loadSeriesOptions();
    toast.success("Series Updated", {
      description: `Updated ${dialogIds.length} sermon${dialogIds.length === 1 ? "" : "s"}.`,
    });
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading sermons...</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-serif">Sermon Series Manager</h1>
        <p className="text-sm text-muted-foreground">
          Move sermons into the correct series and override playlist mappings.
        </p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex-1">
          <Input
            placeholder="Search by title, description, speaker, series..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="generating">Generating</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={seriesFilter} onValueChange={setSeriesFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Series" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All series</SelectItem>
            {seriesOptions.map((series) => (
              <SelectItem key={series} value={series}>
                {series}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={loadSermons}
          className="font-mono text-xs uppercase tracking-widest"
        >
          Refresh
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs font-mono text-muted-foreground">
          Showing {filteredSermons.length} of {sermons.length} sermons
        </p>
        <Button
          onClick={() => openMoveDialog(Array.from(selectedIds))}
          disabled={selectedIds.size === 0}
        >
          Move Selected
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[48px]">
              <Checkbox
                checked={selectedIds.size > 0 && selectedIds.size === filteredSermons.length}
                onCheckedChange={toggleSelectAll}
                aria-label="Select all sermons"
              />
            </TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Series</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Speaker</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredSermons.map((sermon) => {
            const effectiveSeries = sermon.series_override || sermon.series || "Unassigned";
            const isSelected = selectedIds.has(sermon.id);
            return (
              <TableRow key={sermon.id} data-state={isSelected ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(sermon.id)}
                    aria-label={`Select ${sermon.title}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{sermon.title}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{effectiveSeries}</Badge>
                    {sermon.series_override && (
                      <Badge variant="outline">Override</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{sermon.status}</Badge>
                </TableCell>
                <TableCell>{sermon.speaker || "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => openMoveDialog([sermon.id])}>
                    Move
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <SeriesMoveDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        sermonCount={dialogIds.length}
        seriesOptions={seriesOptions}
        defaultSeries={dialogDefaultSeries}
        onSave={handleMoveSeries}
      />
    </div>
  );
}

