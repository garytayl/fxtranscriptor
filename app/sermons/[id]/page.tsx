"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { ArrowLeft, Calendar, ExternalLink, Play, Download, Copy, CheckCircle2, AlertCircle, Loader2, Link2, ChevronDown, ChevronUp, X, Trash2, ChevronLeft, ChevronRight, MoreVertical, RefreshCw, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { Sermon, SermonChunkSummary, SermonChunkVerse } from "@/lib/supabase";
import { analytics, errorTracker } from "@/lib/analytics";
import { AudioUrlDialog } from "@/components/audio-url-dialog";
import { SermonMetadata } from "@/components/sermon-metadata";
import { extractSummaryFromDescription, removeMetadataFromTranscript } from "@/lib/extractMetadata";

interface TranscriptionProgress {
  step: string;
  current?: number;
  total?: number;
  message?: string;
}

export default function SermonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [sermon, setSermon] = useState<Sermon | null>(null);
  const [sermonId, setSermonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<TranscriptionProgress | null>(null);
  const [copied, setCopied] = useState(false);
  const [audioUrlDialogOpen, setAudioUrlDialogOpen] = useState(false);
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set());
  const [summaries, setSummaries] = useState<(SermonChunkSummary & { verses: SermonChunkVerse[] })[]>([]);
  const [expandedSummaryChunks, setExpandedSummaryChunks] = useState<Set<number>>(new Set());
  const [generatingSummaries, setGeneratingSummaries] = useState(false);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);

  // Extract ID from params (Next.js 15+ always uses Promise)
  useEffect(() => {
    const extractId = async () => {
      try {
        console.log("[SermonDetail] Extracting ID from params (Promise)...");
        const resolved = await params;
        const id = resolved?.id;
        if (id) {
          console.log("[SermonDetail] Resolved ID:", id);
          setSermonId(id);
        } else {
          console.error("[SermonDetail] No ID found in params");
          setLoading(false);
        }
      } catch (error) {
        console.error("[SermonDetail] Error extracting ID from params:", error);
        setLoading(false);
      }
    };
    extractId();
  }, [params]);

  // Poll for updates when generating (only when page is visible)
  useEffect(() => {
    if (!sermon || sermon.status !== "generating") {
      setGenerating(false);
      return;
    }

    setGenerating(true);

    const interval = setInterval(async () => {
      // Skip if page is hidden
      if (document.hidden) return;
      
      try {
        const response = await fetch(`/api/catalog/${sermon.id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.sermon) {
            setSermon(data.sermon);
            
            // Update progress from database
            if (data.sermon.progress_json) {
              setProgress(data.sermon.progress_json);
            } else {
              setProgress(null);
            }
            
            // If status changed to completed or failed, stop polling
            if (data.sermon.status === "completed" || data.sermon.status === "failed") {
              setGenerating(false);
              setProgress(null);
            }
          }
        }
      } catch (error) {
        console.error("Error polling for updates:", error);
      }
    }, 10000); // Poll every 10 seconds (less aggressive)

    return () => clearInterval(interval);
  }, [sermon?.id, sermon?.status]);

  useEffect(() => {
    if (sermonId) {
      loadSermon(sermonId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sermonId]);

  // Track page view
  useEffect(() => {
    if (sermon) {
      analytics.sermonViewed(sermon.id, sermon.title || 'Untitled');
    }
  }, [sermon?.id]);

  // Close options menu when clicking outside
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target as Node)) {
        setOptionsMenuOpen(false);
      }
    };
    if (optionsMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [optionsMenuOpen]);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'Escape',
      handler: () => {
        router.push('/');
      },
      description: 'Go back (Esc)',
    },
    {
      key: 'r',
      ctrl: true,
      handler: () => {
        if (sermonId && !loading) {
          loadSermon(sermonId);
        }
      },
      description: 'Refresh sermon (Ctrl+R)',
    },
  ]);

  const fetchSummaries = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/sermons/${id}/summaries`);
      if (response.ok) {
        const data = await response.json();
        setSummaries(data.summaries || []);
        // Expand first chunk by default
        if (data.summaries && data.summaries.length > 0) {
          setExpandedSummaryChunks(new Set([0]));
        }
      }
    } catch (error) {
      console.error("Error fetching summaries:", error);
    }
  }, []);

  const generateSummaries = useCallback(async (id: string) => {
    setGeneratingSummaries(true);
    try {
      const toastId = toast.loading("Generating AI summaries...", {
        description: "This may take a few moments.",
      });
      
      const response = await fetch(`/api/sermons/${id}/summaries/generate`, {
        method: "POST",
      });
      
      const data = await response.json();
      toast.dismiss(toastId);
      
      if (response.ok && data.success) {
        toast.success("Summaries Generated", {
          description: `Generated ${data.generated} summaries.`,
          duration: 3000,
        });
        await fetchSummaries(id);
      } else {
        toast.error("Generation Failed", {
          description: data.error || "Failed to generate summaries",
          duration: 6000,
        });
      }
    } catch (error) {
      console.error("Error generating summaries:", error);
      toast.error("Generation Error", {
        description: error instanceof Error ? error.message : "Unknown error",
        duration: 6000,
      });
    } finally {
      setGeneratingSummaries(false);
    }
  }, [fetchSummaries]);

  const clearSummaries = useCallback(async (id: string) => {
    try {
      const toastId = toast.loading("Clearing summaries...");
      
      const response = await fetch(`/api/sermons/${id}/summaries/clear`, {
        method: "POST",
      });
      
      const data = await response.json();
      toast.dismiss(toastId);
      
      if (response.ok && data.success) {
        toast.success("Summaries Cleared", {
          description: `Deleted ${data.deleted} summaries.`,
          duration: 3000,
        });
        setSummaries([]);
        setExpandedSummaryChunks(new Set());
      } else {
        toast.error("Clear Failed", {
          description: data.error || "Failed to clear summaries",
          duration: 6000,
        });
      }
    } catch (error) {
      console.error("Error clearing summaries:", error);
      toast.error("Clear Error", {
        description: error instanceof Error ? error.message : "Unknown error",
        duration: 6000,
      });
    }
  }, []);

  const loadSermon = useCallback(async (id: string) => {
    try {
      console.log("[SermonDetail] Loading sermon with ID:", id);
      setLoading(true);
      if (!id) {
        throw new Error("Missing sermon ID");
      }
      
      console.log("[SermonDetail] Fetching from /api/catalog/" + id);
      const response = await fetch(`/api/catalog/${id}`, {
        // Add cache control
        next: { revalidate: 30 }, // Revalidate every 30 seconds
      });
      
      console.log("[SermonDetail] Response status:", response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[SermonDetail] API error:", errorData);
        throw new Error(errorData.error || "Failed to load sermon");
      }

      const data = await response.json();
      console.log("[SermonDetail] Received data:", data);
      
      if (!data.sermon) {
        console.error("[SermonDetail] No sermon in response:", data);
        throw new Error("Sermon not found");
      }

      console.log("[SermonDetail] Setting sermon:", data.sermon.title);
      setSermon(data.sermon);
      setGenerating(data.sermon.status === "generating");
      if (data.sermon.progress_json) {
        setProgress(data.sermon.progress_json);
      }
      // Fetch summaries if transcript exists
      if (data.sermon.transcript || data.sermon.progress_json?.completedChunks) {
        fetchSummaries(id);
      }
    } catch (error) {
      console.error("[SermonDetail] Error loading sermon:", error);
      setSermon(null); // Set to null so error state shows
    } finally {
      setLoading(false);
    }
  }, [fetchSummaries]);

  const generateTranscript = useCallback(async () => {
    if (!sermon || generating) return;

    // Immediately update status to "generating" in UI
    setSermon((prev) => prev ? { ...prev, status: "generating" as const, progress_json: { step: "queued", message: "Queued for transcription..." } } : null);
    setGenerating(true);
    setProgress({ step: "queued", message: "Queued for transcription..." });

    // Show loading toast
    const toastId = toast.loading("Starting transcription...", {
      description: "This may take several minutes. You can leave this page.",
    });

    try {
      // Fire and forget - don't wait for response
      fetch("/api/catalog/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sermonId: sermon.id }),
      })
      .then(async (response) => {
        const data = await response.json().catch(() => ({ error: "Failed to parse response" }));

        if (!response.ok && response.status !== 200) {
          const errorMsg = data.error || `HTTP ${response.status}: ${response.statusText}`;
          
          // Update sermon status to failed
          setSermon((prev) => prev ? { ...prev, status: "failed" as const, error_message: errorMsg, progress_json: null } : null);
          setGenerating(false);
          setProgress(null);
          return;
        }

        if (data.success && data.sermon) {
          // Update sermon in local state
          setSermon(data.sermon);
          setGenerating(false);
          setProgress(null);
        } else {
          // Handle case where transcript generation failed
          const errorMsg = data.error || "Unknown error";
          
          // Update sermon status to failed
          setSermon((prev) => prev ? { ...prev, status: "failed" as const, error_message: errorMsg, progress_json: null } : null);
          setGenerating(false);
          setProgress(null);
        }
      })
      .catch((error) => {
        console.error("Error generating transcript:", error);
        setSermon((prev) => prev ? { ...prev, status: "failed" as const, error_message: error instanceof Error ? error.message : "Unknown error occurred", progress_json: null } : null);
        setGenerating(false);
        setProgress(null);
      });
    } catch (error) {
      console.error("Error initiating transcript generation:", error);
      setSermon((prev) => prev ? { ...prev, status: "failed" as const, error_message: error instanceof Error ? error.message : "Unknown error occurred", progress_json: null } : null);
      setGenerating(false);
      setProgress(null);
    }
  }, [sermon, generating]);

  const handleCopyAll = useCallback(async () => {
    if (!sermon?.transcript) return;
    
    try {
      await navigator.clipboard.writeText(sermon.transcript);
      setCopied(true);
      toast.success("Copied to clipboard", {
        description: `${sermon.transcript.length.toLocaleString()} characters copied`,
        duration: 2000,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Copy Failed", {
        description: "Please select and copy manually.",
        duration: 4000,
      });
    }
  }, [sermon?.transcript]);

  const handleDownload = useCallback(() => {
    if (!sermon?.transcript) {
      toast.error("No Transcript", {
        description: "This sermon doesn't have a transcript yet.",
        duration: 3000,
      });
      return;
    }
    
    try {
      const blob = new Blob([sermon.transcript], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sermon.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_transcript.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      analytics.transcriptDownloaded(sermon.id);
      toast.success("Download Started", {
        description: `${sermon.transcript.length.toLocaleString()} characters`,
        duration: 2000,
      });
    } catch (error) {
      toast.error("Download Failed", {
        description: error instanceof Error ? error.message : "Unknown error",
        duration: 4000,
      });
    }
  }, [sermon?.transcript, sermon?.title]);

  const updateAudioUrl = useCallback(async (sermon: Sermon, audioUrl: string, podbeanUrl?: string) => {
    try {
      const toastId = toast.loading("Updating audio URL...");
      
      const response = await fetch("/api/catalog/update-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sermonId: sermon.id,
          audioUrl: audioUrl || undefined,
          podbeanUrl: podbeanUrl || undefined,
          clearError: true,
        }),
      });

      const data = await response.json();
      
      toast.dismiss(toastId);
      
      if (data.success && data.sermon) {
        setSermon(data.sermon);
        setAudioUrlDialogOpen(false);
        toast.success("Audio URL Updated", {
          description: "You can now generate the transcript.",
          duration: 3000,
        });
      } else {
        throw new Error(data.error || "Failed to update audio URL");
      }
    } catch (error) {
      console.error("Error updating audio URL:", error);
      toast.error("Update Failed", {
        description: error instanceof Error ? error.message : "Unknown error",
        duration: 6000,
      });
      throw error;
    }
  }, []);

  const getStatusBadge = useCallback((sermon: Sermon) => {
    switch (sermon.status) {
      case "completed":
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="size-3" />
            Completed
          </Badge>
        );
      case "generating":
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="size-3 animate-spin" />
            Generating
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="size-3" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  }, []);

  const getSourceBadge = useCallback((source: string | null) => {
    if (!source) return null;
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      youtube: { label: "YouTube", variant: "default" },
      podbean: { label: "Podbean", variant: "secondary" },
      apple: { label: "Apple", variant: "outline" },
      generated: { label: "Generated", variant: "outline" },
    };
    const config = variants[source] || { label: source, variant: "outline" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  }, []);

  if (loading) {
    return (
      <main className="relative min-h-screen">
        <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
        <div className="relative z-10 py-12 pl-6 md:pl-28 pr-6 md:pr-12">
          <div className="mb-8">
            <div className="h-10 w-32 bg-muted animate-pulse rounded mb-4" />
            <div className="h-16 w-3/4 bg-muted animate-pulse rounded mb-6" />
            <div className="flex gap-4">
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-12 w-full bg-muted animate-pulse rounded" />
            <div className="h-12 w-full bg-muted animate-pulse rounded" />
            <div className="h-64 w-full bg-muted animate-pulse rounded" />
          </div>
        </div>
      </main>
    );
  }

  if (!sermon) {
    return (
      <main className="relative min-h-screen">
        <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
        <div className="relative z-10 py-32 pl-6 md:pl-28 pr-6 md:pr-12">
          <div className="text-center">
            <h1 className="font-[var(--font-bebas)] text-4xl mb-4">Sermon Not Found</h1>
            <Button onClick={() => router.push("/")} variant="outline" className="font-mono text-xs uppercase tracking-widest">
              <ArrowLeft className="size-4 mr-2" />
              Back to Catalog
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen">
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
      
      <div className="relative z-10 py-6 sm:py-12 pl-4 sm:pl-6 md:pl-28 pr-4 sm:pr-6 md:pr-12">
        {/* Back Button */}
        <Button
          onClick={() => router.push("/")}
          variant="ghost"
          size="sm"
          className="mb-6 sm:mb-8 font-mono text-xs uppercase tracking-widest gap-2 hover:text-accent touch-manipulation"
        >
          <ArrowLeft className="size-4" />
          Back to Catalog
        </Button>

        {/* Header */}
        <div className="mb-8 sm:mb-12">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Sermon Detail</span>
          <h1 className="mt-4 font-[var(--font-bebas)] text-2xl sm:text-4xl md:text-6xl tracking-tight mb-4 sm:mb-6">
            {sermon.title}
          </h1>
          
          <div className="flex flex-wrap items-center gap-4 mb-6">
            {getStatusBadge(sermon)}
            {sermon.transcript_source && getSourceBadge(sermon.transcript_source)}
            {sermon.date && (
              <span className="flex items-center gap-1.5 text-sm font-mono text-muted-foreground">
                <Calendar className="size-4" />
                {format(new Date(sermon.date), "MMMM d, yyyy")}
              </span>
            )}
          </div>

          {/* Series and Speaker Metadata */}
          <div className="mb-6">
            <SermonMetadata series={sermon.series} speaker={sermon.speaker} />
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-4">
            {sermon.podbean_url && (
              <a
                href={sermon.podbean_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-mono text-muted-foreground hover:text-accent transition-colors"
              >
                <ExternalLink className="size-4" />
                Podbean
              </a>
            )}
            {sermon.youtube_url && (
              <a
                href={sermon.youtube_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-mono text-muted-foreground hover:text-accent transition-colors"
              >
                <ExternalLink className="size-4" />
                YouTube
              </a>
            )}
          </div>
        </div>

        {/* Description / Summary */}
        {sermon.description && (
          <div className="mb-12 max-w-3xl">
            {(() => {
              // Extract summary from description (removes [SERIES] and [SPEAKER] tags, keeps summary content)
              const summary = extractSummaryFromDescription(sermon.description);
              
              if (summary) {
                return (
                  <div>
                    <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">Summary</h3>
                    <p className="font-mono text-sm text-foreground leading-relaxed">
                      {summary}
                    </p>
                  </div>
                );
              }
              
              // Fallback: show description without metadata tags
              const cleaned = removeMetadataFromTranscript(sermon.description);
              
              if (cleaned) {
                return (
                  <p className="font-mono text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {cleaned}
                  </p>
                );
              }
              
              return null;
            })()}
          </div>
        )}

        {/* Progress Display */}
        {(generating || progress || sermon.status === "generating") && (
          <div className="mb-12 p-6 border border-border/30 rounded-lg bg-card/50">
            <div className="flex items-start gap-4">
              <Loader2 className="size-5 animate-spin text-accent mt-0.5" />
              <div className="flex-1">
                <h3 className="font-mono text-sm uppercase tracking-widest mb-2">Transcription Progress</h3>
                {progress?.message && (
                  <p className="text-sm text-muted-foreground font-mono">{progress.message}</p>
                )}
                {sermon.progress_json?.message && (
                  <p className="text-sm text-muted-foreground font-mono">
                    {sermon.progress_json.message}
                    {sermon.progress_json.current && sermon.progress_json.total && (
                      <span className="ml-2 text-xs text-muted-foreground/70">
                        ({sermon.progress_json.current}/{sermon.progress_json.total})
                      </span>
                    )}
                  </p>
                )}
                {!progress?.message && !sermon.progress_json?.message && sermon.status === "generating" && (
                  <p className="text-sm text-muted-foreground font-mono">Processing... Please wait.</p>
                )}
                {/* Show completed chunks if available */}
                {sermon.progress_json?.completedChunks && 
                 Object.keys(sermon.progress_json.completedChunks).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border/30">
                    <p className="text-xs font-mono text-muted-foreground mb-2">
                      ✅ Completed chunks: {Object.keys(sermon.progress_json.completedChunks).length}
                      {sermon.progress_json.total && 
                       ` / ${sermon.progress_json.total}`}
                    </p>
                    {sermon.progress_json.failedChunks && 
                     Object.keys(sermon.progress_json.failedChunks).length > 0 && (
                      <p className="text-xs font-mono text-destructive/70 mb-2">
                        ❌ Failed chunks: {Object.keys(sermon.progress_json.failedChunks).length}
                      </p>
                    )}
                    {sermon.progress_json?.completedChunks && 
                     Object.keys(sermon.progress_json.completedChunks).length > 0 && (
                      <p className="text-xs text-muted-foreground/70 italic mb-4">
                        Progress is saved automatically. If transcription fails, you can retry and it will resume from the last completed chunk.
                      </p>
                    )}
                  </div>
                )}
                {/* Cancel and Delete buttons - Always show cancel when generating */}
                <div className="flex gap-2 mt-4">
                  {sermon.status === "generating" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs font-mono uppercase tracking-widest border-amber-500/50 hover:border-amber-500 hover:text-amber-500"
                      onClick={async () => {
                        const hasChunks = sermon.progress_json?.completedChunks && 
                                         Object.keys(sermon.progress_json.completedChunks).length > 0;
                        const confirmMsg = hasChunks 
                          ? "Cancel transcription? Completed chunks will be preserved."
                          : "Cancel transcription? No chunks have been completed yet.";
                        
                        toast.promise(
                          (async () => {
                            const response = await fetch("/api/catalog/manage-transcription", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ sermonId: sermon.id, action: "cancel" }),
                            });
                            const data = await response.json();
                            if (data.success && data.sermon) {
                              setSermon(data.sermon);
                              setGenerating(false);
                              setProgress(null);
                              return data;
                            } else {
                              throw new Error(data.error || "Failed to cancel transcription");
                            }
                          })(),
                          {
                            loading: "Cancelling transcription...",
                            success: hasChunks ? "Transcription cancelled. Completed chunks preserved." : "Transcription cancelled.",
                            error: (err) => err.message || "Failed to cancel transcription",
                          }
                        );
                      }}
                    >
                      <X className="size-3 mr-1" />
                      Cancel Transcription
                    </Button>
                  )}
                  {sermon.progress_json?.completedChunks && 
                   Object.keys(sermon.progress_json.completedChunks).length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs font-mono uppercase tracking-widest border-destructive/50 hover:border-destructive hover:text-destructive"
                      onClick={async () => {
                        toast.promise(
                          (async () => {
                            const response = await fetch("/api/catalog/manage-transcription", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ sermonId: sermon.id, action: "delete-chunks" }),
                            });
                            const data = await response.json();
                            if (data.success && data.sermon) {
                              setSermon(data.sermon);
                              setExpandedChunks(new Set());
                              return data;
                            } else {
                              throw new Error(data.error || "Failed to delete chunks");
                            }
                          })(),
                          {
                            loading: "Deleting chunks...",
                            success: "All chunks deleted successfully",
                            error: (err) => err.message || "Failed to delete chunks",
                          }
                        );
                      }}
                    >
                      <Trash2 className="size-3 mr-1" />
                      Delete Chunks
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Completed Chunks Display - Show even if not generating if chunks exist */}
        {sermon.progress_json?.completedChunks && 
         Object.keys(sermon.progress_json.completedChunks).length > 0 && (
          <div className="mb-12 border border-border/30 rounded-lg p-6 bg-card/50">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold font-mono uppercase tracking-widest mb-1">
                  Completed Chunks
                </h3>
                <p className="text-xs text-muted-foreground">
                  {Object.keys(sermon.progress_json.completedChunks).length}
                  {sermon.progress_json.total && ` / ${sermon.progress_json.total}`} chunks completed
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-mono uppercase tracking-widest border-destructive/50 hover:border-destructive hover:text-destructive"
                onClick={async () => {
                  if (!confirm("Delete all completed chunks? This cannot be undone.")) {
                    return;
                  }
                  try {
                    const response = await fetch("/api/catalog/manage-transcription", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ sermonId: sermon.id, action: "delete-chunks" }),
                    });
                    const data = await response.json();
                    if (data.success && data.sermon) {
                      setSermon(data.sermon);
                      // Clear expanded chunks if they were deleted
                      setExpandedChunks(new Set());
                    } else {
                      alert(data.error || "Failed to delete chunks");
                    }
                  } catch (error) {
                    console.error("Error deleting chunks:", error);
                    alert("Failed to delete chunks");
                  }
                }}
              >
                <Trash2 className="size-3 mr-1" />
                Delete All
              </Button>
            </div>
            
            <div className="space-y-2">
              {Object.entries(sermon.progress_json.completedChunks)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([index, text]) => {
                  const chunkIndex = Number(index);
                  const isExpanded = expandedChunks.has(chunkIndex);
                  const chunkText = text as string;
                  
                  return (
                    <div key={chunkIndex} className="border rounded-lg overflow-hidden">
                      <button
                        onClick={() => {
                          const newExpanded = new Set(expandedChunks);
                          if (isExpanded) {
                            newExpanded.delete(chunkIndex);
                          } else {
                            newExpanded.add(chunkIndex);
                          }
                          setExpandedChunks(newExpanded);
                        }}
                        className="w-full flex items-center justify-between p-3 bg-card hover:bg-card/80 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="size-4 text-green-500" />
                          <span className="text-sm font-mono font-semibold">
                            Chunk {chunkIndex + 1}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({chunkText.length.toLocaleString()} chars)
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="p-4 border-t bg-card/30">
                          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground max-h-96 overflow-auto mb-3">
                            {chunkText}
                          </pre>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => {
                                navigator.clipboard.writeText(chunkText);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                              }}
                            >
                              {copied ? (
                                <>
                                  <CheckCircle2 className="size-3 mr-1" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="size-3 mr-1" />
                                  Copy Chunk
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Error Message */}
        {sermon.status === "failed" && sermon.error_message && (
          <div className="mb-12 p-6 border border-destructive/50 rounded-lg bg-destructive/5">
            <div className="flex items-start gap-4">
              <AlertCircle className="size-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <h3 className="font-mono text-sm uppercase tracking-widest mb-2 text-destructive">Error</h3>
                <p className="text-sm text-muted-foreground font-mono whitespace-pre-wrap">
                  {sermon.error_message}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mb-8 sm:mb-12 flex flex-wrap gap-3 sm:gap-4">
          {!sermon.audio_url && !sermon.youtube_url && (
            <Button
              variant="outline"
              size="lg"
              className="font-mono text-xs uppercase tracking-widest border-amber-500/50 hover:border-amber-500 hover:text-amber-500 touch-manipulation"
              onClick={() => setAudioUrlDialogOpen(true)}
            >
              <Link2 className="size-4 mr-2" />
              Set Audio URL
            </Button>
          )}
          
          {sermon.transcript && (
            <Button
              variant="outline"
              size="lg"
              className="font-mono text-xs uppercase tracking-widest gap-2 touch-manipulation"
              onClick={() => router.push(`/sermons/${sermon.id}/raw`)}
            >
              <FileText className="size-4" />
              Show Full Transcript
            </Button>
          )}
          
          {!sermon.transcript && (
            <Button
              variant={sermon.status === "generating" ? "secondary" : "default"}
              size="lg"
              className="font-mono text-xs uppercase tracking-widest gap-2 touch-manipulation"
              disabled={generating || sermon.status === "generating" || (!sermon.audio_url && !sermon.youtube_url)}
              onClick={generateTranscript}
            >
              {generating || sermon.status === "generating" ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating... (you can leave)
                </>
              ) : sermon.status === "failed" ? (
                <>
                  <AlertCircle className="size-4" />
                  Retry Generate
                </>
              ) : sermon.youtube_url && !sermon.audio_url ? (
                <>
                  <Play className="size-4" />
                  Generate from YouTube
                </>
              ) : (
                <>
                  <Play className="size-4" />
                  Generate Transcript
                </>
              )}
            </Button>
          )}
        </div>

        {/* Chunk Summaries Display */}
        {(sermon.transcript || sermon.progress_json?.completedChunks) && (
          <div className="border border-accent/20 rounded-lg p-6 bg-card/50 glow-border">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-mono text-sm uppercase tracking-widest">AI Summaries</h2>
              <div className="flex items-center gap-2">
                {summaries.length > 0 && (
                  <div className="relative" ref={optionsMenuRef}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs font-mono uppercase tracking-widest"
                      onClick={() => setOptionsMenuOpen(!optionsMenuOpen)}
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                    {optionsMenuOpen && (
                      <div className="absolute right-0 top-full mt-2 z-10 bg-card border border-border/30 rounded-lg shadow-lg p-2 min-w-[200px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-xs font-mono uppercase tracking-widest"
                          onClick={async () => {
                            setOptionsMenuOpen(false);
                            if (sermon.id) {
                              await clearSummaries(sermon.id);
                            }
                          }}
                        >
                          <Trash2 className="size-3 mr-2" />
                          Clear Summaries
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-xs font-mono uppercase tracking-widest"
                          onClick={async () => {
                            setOptionsMenuOpen(false);
                            if (sermon.id) {
                              await generateSummaries(sermon.id);
                            }
                          }}
                          disabled={generatingSummaries}
                        >
                          <RefreshCw className={`size-3 mr-2 ${generatingSummaries ? "animate-spin" : ""}`} />
                          Regenerate Summaries
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {generatingSummaries ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-accent" />
                <span className="ml-3 font-mono text-sm text-muted-foreground">Generating summaries...</span>
              </div>
            ) : summaries.length === 0 ? (
              <div className="text-center py-12">
                <p className="font-mono text-sm text-muted-foreground mb-4">
                  No summaries generated yet.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs uppercase tracking-widest"
                  onClick={() => sermon.id && generateSummaries(sermon.id)}
                >
                  <RefreshCw className="size-3 mr-2" />
                  Generate Summaries
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {summaries.map((summary, index) => {
                  const isExpanded = expandedSummaryChunks.has(index);
                  return (
                    <div
                      key={summary.id}
                      className="border border-accent/20 rounded-lg overflow-hidden transition-all hover:border-accent/40 hover:shadow-[0_0_20px_rgba(255,165,0,0.1)]"
                    >
                      <button
                        onClick={() => {
                          const newExpanded = new Set(expandedSummaryChunks);
                          if (isExpanded) {
                            newExpanded.delete(index);
                          } else {
                            newExpanded.add(index);
                          }
                          setExpandedSummaryChunks(newExpanded);
                        }}
                        className="w-full flex items-center justify-between p-4 bg-card/30 hover:bg-card/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-semibold text-accent">
                            Chunk {index + 1}
                          </span>
                          <span className="font-mono text-sm text-muted-foreground line-clamp-1">
                            {summary.summary.substring(0, 60)}...
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="p-4 border-t border-accent/10 bg-card/20 space-y-4">
                          <div>
                            <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                              Summary
                            </h3>
                            <p className="font-mono text-sm text-foreground leading-relaxed">
                              {summary.summary}
                            </p>
                          </div>

                          {/* Verses */}
                          {summary.verses && summary.verses.length > 0 && (
                            <div>
                              <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                                Bible Verses Referenced
                              </h3>
                              <div className="flex flex-wrap gap-2">
                                {summary.verses.map((verse) => (
                                  <Badge
                                    key={verse.id}
                                    variant="secondary"
                                    className="font-mono text-xs border-accent/30 hover:border-accent/50 hover:shadow-[0_0_10px_rgba(255,165,0,0.2)] transition-all"
                                  >
                                    {verse.full_reference}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Audio URL Dialog */}
      <AudioUrlDialog
        sermon={sermon}
        open={audioUrlDialogOpen}
        onOpenChange={setAudioUrlDialogOpen}
        onSave={updateAudioUrl}
      />
    </main>
  );
}
