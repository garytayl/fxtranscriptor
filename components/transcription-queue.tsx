"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Loader2, Clock, CheckCircle2, AlertCircle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

interface QueueItem {
  id: string;
  sermonId: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  position: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  sermon?: {
    id: string;
    title: string;
    date?: string;
    status: string;
    progress_json?: any;
  };
}

interface QueueData {
  processing: QueueItem | null;
  queued: QueueItem[];
  all: QueueItem[];
}

export function TranscriptionQueue() {
  const [queue, setQueue] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<Set<string>>(new Set());

  const loadQueue = useCallback(async () => {
    try {
      const response = await fetch("/api/queue/list");
      if (!response.ok) {
        console.error("Failed to load queue");
        return;
      }

      const data = await response.json();
      if (data.success) {
        setQueue(data.queue);
      }
    } catch (error) {
      console.error("Error loading queue:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();

    // Trigger processor on mount and periodically
    const triggerProcessor = async () => {
      try {
        await fetch("/api/queue/processor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        // Silently fail - processor will be called by cron or other means
        console.log("Processor trigger failed (non-critical):", error);
      }
    };

    // Trigger immediately
    triggerProcessor();

    // Poll queue every 5 seconds and trigger processor every 10 seconds
    const queueInterval = setInterval(loadQueue, 5000);
    const processorInterval = setInterval(triggerProcessor, 10000);
    
    return () => {
      clearInterval(queueInterval);
      clearInterval(processorInterval);
    };
  }, [loadQueue]);

  const handleCancel = useCallback(
    async (sermonId: string) => {
      if (cancelling.has(sermonId)) return;

      setCancelling((prev) => new Set(prev).add(sermonId));

      try {
        const response = await fetch("/api/queue/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sermonId }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          toast.success("Cancelled", {
            description: "Transcription cancelled",
            duration: 2000,
          });
          await loadQueue();
        } else {
          toast.error("Cancel Failed", {
            description: data.error || "Failed to cancel transcription",
            duration: 4000,
          });
        }
      } catch (error) {
        console.error("Error cancelling:", error);
        toast.error("Cancel Failed", {
          description: error instanceof Error ? error.message : "Unknown error",
          duration: 4000,
        });
      } finally {
        setCancelling((prev) => {
          const next = new Set(prev);
          next.delete(sermonId);
          return next;
        });
      }
    },
    [cancelling, loadQueue]
  );

  const getStatusBadge = (item: QueueItem) => {
    switch (item.status) {
      case "processing":
        const progressMessage = item.sermon?.progress_json?.message || "Processing...";
        return (
          <Badge variant="secondary" className="gap-1" title={progressMessage}>
            <Loader2 className="size-3 animate-spin" />
            Processing
          </Badge>
        );
      case "queued":
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="size-3" />
            Queued
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="size-3" />
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="size-3" />
            Failed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="gap-1">
            <X className="size-3" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{item.status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          <span className="font-mono text-sm">Loading queue...</span>
        </div>
      </Card>
    );
  }

  if (!queue || (queue.processing === null && queue.queued.length === 0)) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-mono text-sm font-semibold uppercase tracking-widest mb-1">
              Transcription Queue
            </h3>
            <p className="text-xs text-muted-foreground">No items in queue</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-mono text-sm font-semibold uppercase tracking-widest mb-1">
              Transcription Queue
            </h3>
            <p className="text-xs text-muted-foreground">
              {queue.processing ? "1 processing" : "0 processing"} • {queue.queued.length} queued
            </p>
          </div>
        </div>

        {/* Currently Processing */}
        {queue.processing && (
          <div className="border rounded-lg p-3 bg-card space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {getStatusBadge(queue.processing)}
                  <span className="text-xs font-mono text-muted-foreground">
                    Position: {queue.processing.position}
                  </span>
                </div>
                <p className="text-sm font-medium truncate">
                  {queue.processing.sermon?.title || "Unknown Sermon"}
                </p>
                {queue.processing.sermon?.progress_json?.message && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {queue.processing.sermon.progress_json.message}
                    {queue.processing.sermon.progress_json.current &&
                      queue.processing.sermon.progress_json.total && (
                        <span className="ml-1">
                          ({queue.processing.sermon.progress_json.current}/
                          {queue.processing.sermon.progress_json.total})
                        </span>
                      )}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCancel(queue.processing!.sermonId)}
                disabled={cancelling.has(queue.processing.sermonId)}
                className="flex-shrink-0"
              >
                {cancelling.has(queue.processing.sermonId) ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <X className="size-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Queued Items */}
        {queue.queued.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Queued ({queue.queued.length})
            </div>
            {queue.queued.map((item) => (
              <div
                key={item.id}
                className="border rounded-lg p-3 bg-card/50 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusBadge(item)}
                      <span className="text-xs font-mono text-muted-foreground">
                        Position: {item.position}
                      </span>
                    </div>
                    <p className="text-sm font-medium truncate">
                      {item.sermon?.title || "Unknown Sermon"}
                    </p>
                    {item.sermon?.progress_json?.message && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.sermon.progress_json.message}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCancel(item.sermonId)}
                    disabled={cancelling.has(item.sermonId)}
                    className="flex-shrink-0"
                  >
                    {cancelling.has(item.sermonId) ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <X className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
