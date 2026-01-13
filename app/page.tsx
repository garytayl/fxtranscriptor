"use client";

import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { RefreshCw, Play, Copy, Download, CheckCircle2, AlertCircle, Loader2, Calendar, ExternalLink, Link2, Save, ChevronDown, ChevronUp, Search, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { HeroSection } from "@/components/hero-section";
import { SideNav } from "@/components/side-nav";
import { SermonSeriesSection } from "@/components/sermon-series-section";
import dynamic from "next/dynamic";
import { SermonCard } from "@/components/sermon-card";
import { SermonSkeleton } from "@/components/sermon-skeleton";
import { Sermon } from "@/lib/supabase";

// Lazy load heavy components
const BatchOperations = dynamic(() => import("@/components/batch-operations").then(mod => ({ default: mod.BatchOperations })), {
  ssr: false,
  loading: () => <div className="h-16" />,
});

const SeriesDetailView = dynamic(() => import("@/components/series-detail-view").then(mod => ({ default: mod.SeriesDetailView })), {
  ssr: false,
});

const AudioUrlDialog = dynamic(() => import("@/components/audio-url-dialog").then(mod => ({ default: mod.AudioUrlDialog })), {
  ssr: false,
});
import { groupSermonsBySeries, SermonSeries } from "@/lib/extractSeries";
import { exportToCSV, exportToJSON, downloadFile } from "@/lib/export";
import { analytics, errorTracker } from "@/lib/analytics";
import { format } from "date-fns";

export default function Home() {
  const router = useRouter();
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedSermon, setSelectedSermon] = useState<Sermon | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<SermonSeries | null>(null);
  const [copied, setCopied] = useState(false);
  const [playlistSeriesMap, setPlaylistSeriesMap] = useState<Map<string, string>>(new Map());
  const [showAudioOverride, setShowAudioOverride] = useState(false);
  const [audioOverrideUrl, setAudioOverrideUrl] = useState("");
  const [updatingAudio, setUpdatingAudio] = useState(false);
  const [audioUrlDialogOpen, setAudioUrlDialogOpen] = useState(false);
  const [audioUrlDialogSermon, setAudioUrlDialogSermon] = useState<Sermon | null>(null);
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Filter sermons based on search and status
  const filteredSermons = useMemo(() => {
    let filtered = sermons;
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(sermon => 
        sermon.title.toLowerCase().includes(query) ||
        sermon.description?.toLowerCase().includes(query) ||
        sermon.transcript?.toLowerCase().includes(query)
      );
    }
    
    // Status filter
    if (statusFilter) {
      filtered = filtered.filter(sermon => sermon.status === statusFilter);
    }
    
    return filtered;
  }, [sermons, searchQuery, statusFilter]);

  // Group filtered sermons by series (using playlist data if available)
  const { series: sermonSeries, ungrouped } = useMemo(() => {
    return groupSermonsBySeries(filteredSermons, playlistSeriesMap);
  }, [filteredSermons, playlistSeriesMap]);

  // Load sermons on mount (which will also reload playlist series)
  useEffect(() => {
    loadSermons();
    // Also load playlist series initially in case sermons are already loaded
    loadPlaylistSeries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'k',
      ctrl: true,
      handler: () => {
        // Focus search input
        const searchInput = document.querySelector('input[type="text"][placeholder*="Search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      },
      description: 'Focus search (Ctrl+K)',
    },
    {
      key: 'r',
      ctrl: true,
      shift: true,
      handler: () => {
        if (!syncing) {
          syncCatalog();
        }
      },
      description: 'Sync catalog (Ctrl+Shift+R)',
    },
    {
      key: 'Escape',
      handler: () => {
        // Close dialogs
        if (selectedSermon) {
          setSelectedSermon(null);
        }
        if (selectedSeries) {
          setSelectedSeries(null);
        }
        if (showAudioOverride) {
          setShowAudioOverride(false);
        }
        // Clear search
        setSearchQuery("");
        setStatusFilter(null);
      },
      description: 'Close dialogs / Clear filters (Esc)',
    },
  ]);

  // Refresh selected sermon when sermons state updates to ensure we have latest data
  useEffect(() => {
    if (selectedSermon) {
      // Find the latest version of this sermon from the sermons state
      const latestSermon = sermons.find(s => s.id === selectedSermon.id);
      if (latestSermon) {
        // Only update if critical fields actually changed to avoid unnecessary re-renders
        const hasNewData = 
          latestSermon.youtube_url !== selectedSermon.youtube_url ||
          latestSermon.audio_url !== selectedSermon.audio_url ||
          latestSermon.status !== selectedSermon.status ||
          latestSermon.transcript !== selectedSermon.transcript ||
          JSON.stringify(latestSermon.progress_json) !== JSON.stringify(selectedSermon.progress_json);
        
        if (hasNewData) {
          console.log('[Dialog] Refreshing selected sermon with latest data');
          setSelectedSermon(latestSermon);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sermons, selectedSermon?.id]);

  // Light polling for progress updates (only when page is visible and has generating sermons)
  // Less aggressive - checks every 10 seconds, and only if page is visible
  useEffect(() => {
    // Find all sermons that are generating
    const generatingSermonIds = sermons
      .filter((s) => s.status === "generating")
      .map((s) => s.id);

    if (generatingSermonIds.length === 0) return;

    // Only poll if page is visible (user is on the page)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden - stop polling, will resume when visible
        return;
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const interval = setInterval(async () => {
      // Skip if page is hidden
      if (document.hidden) return;
      
      try {
        // Fetch updated sermons
        const response = await fetch("/api/catalog/list");
        if (response.ok) {
          const data = await response.json();
          if (data.sermons) {
            // Update sermons that are still generating or have changed status
            setSermons((prev) => {
              const updated = [...prev];
              let changed = false;

              for (const updatedSermon of data.sermons) {
                const index = updated.findIndex((s) => s.id === updatedSermon.id);
                if (index >= 0) {
                  // Update if status or progress changed
                  const prevSermon = updated[index];
                  const statusChanged = prevSermon.status !== updatedSermon.status;
                  const progressChanged = JSON.stringify(prevSermon.progress_json) !== JSON.stringify(updatedSermon.progress_json);
                  
                  if (statusChanged || progressChanged) {
                    updated[index] = updatedSermon;
                    changed = true;
                    
                    // If dialog is open for this sermon, update it
                    if (selectedSermon?.id === updatedSermon.id) {
                      setSelectedSermon(updatedSermon);
                    }
                  }
                }
              }

              return changed ? updated : prev;
            });
          }
        }
      } catch (error) {
        console.error("Error polling for progress updates:", error);
      }
    }, 10000); // Poll every 10 seconds (less aggressive)

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sermons, selectedSermon]);

  const loadPlaylistSeries = useCallback(async () => {
    try {
      // Playlists from FX Church's sermon series
      // These playlists organize sermons into series automatically
      const defaultPlaylists = [
        "https://youtube.com/playlist?list=PLQwpPWOYg4MOLr9lUNMBgjCCV0ifkKMDu", // John: πιστεύω - Fall 2025 (21 videos)
        // Add more playlists here or fetch from an API endpoint
      ];

      if (defaultPlaylists.length === 0) return;

      const response = await fetch("/api/playlists/fetch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playlistUrls: defaultPlaylists }),
      });

      if (!response.ok) {
        console.warn("Failed to fetch playlist series data:", response.status);
        return;
      }

      const data = await response.json();
      
      if (data.success && data.playlists) {
        // Create a map of sermon IDs to series names from playlists
        const seriesMap = new Map<string, string>();
        
        for (const playlist of data.playlists) {
          console.log(`[Playlist Series] Playlist "${playlist.seriesName}": ${playlist.matchedSermonCount} matched sermons out of ${playlist.videoCount} videos`);
          for (const sermonId of playlist.sermonIds || []) {
            // Use playlist title as series name (already cleaned by API)
            seriesMap.set(sermonId, playlist.seriesName);
          }
        }
        
        setPlaylistSeriesMap(seriesMap);
        console.log(`[Playlist Series] Loaded ${seriesMap.size} sermon-series mappings from ${data.playlists.length} playlists`);
        console.log(`[Playlist Series] Sermon IDs in map:`, Array.from(seriesMap.keys()).slice(0, 5), seriesMap.size > 5 ? `... and ${seriesMap.size - 5} more` : '');
      }
    } catch (error) {
      console.warn("Error loading playlist series data (non-critical):", error);
      // Don't block the app if playlist fetch fails - fallback to title extraction
    }
  }, []);

  const loadSermons = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/catalog/list", {
        // Add cache control for better performance
        next: { revalidate: 60 }, // Revalidate every 60 seconds
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || `HTTP ${response.status}`;
        
        if (errorMsg.includes("tables not found") || errorMsg.includes("schema")) {
          console.error("Database setup required:", errorMsg);
          // Don't show alert on every load, just log it
        } else {
          console.error("Error loading sermons:", errorMsg);
        }
        
        setSermons([]);
        return;
      }
      
      const data = await response.json();
      const loadedSermons = data.sermons || [];
      setSermons(loadedSermons);
      
      // If a sermon dialog is open, refresh its data from the loaded sermons
      if (selectedSermon) {
        const updatedSermon = loadedSermons.find((s: Sermon) => s.id === selectedSermon.id);
        if (updatedSermon) {
          setSelectedSermon(updatedSermon);
        }
      }
      
      // Reload playlist series after sermons load to ensure proper matching
      // This ensures the series map is created with the latest sermon data
      await loadPlaylistSeries();
      
      // If we got an error in the response but 200 status
      if (data.error && data.error.includes("tables not found")) {
        console.error("Database setup required:", data.error);
      }
    } catch (error) {
      console.error("Error loading sermons:", error);
      setSermons([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const syncCatalog = useCallback(async () => {
    try {
      setSyncing(true);
      
      // Show loading toast
      const syncToastId = toast.loading("Syncing catalog...", {
        description: "Fetching sermons from Podbean and YouTube",
      });
      
      const response = await fetch("/api/catalog/sync");
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        const details = errorData.details ? `\n\nDetails: ${errorData.details}` : "";
        
        toast.dismiss(syncToastId);
        if (errorMsg.includes("tables not found") || errorMsg.includes("schema")) {
          toast.error("Database Setup Required", {
            description: `${errorMsg}${details}\n\nPlease run the schema.sql file in your Supabase SQL Editor.`,
            duration: 10000,
          });
        } else {
          toast.error("Sync Failed", {
            description: `${errorMsg}${details}`,
            duration: 8000,
          });
        }
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Track catalog sync
        analytics.catalogSynced();
        // Reload sermons after sync
        await loadSermons();
        toast.dismiss(syncToastId);
        toast.success("Catalog Synced", {
          description: `Found ${data.summary.matchedSermons} sermons. Created: ${data.summary.created}, Updated: ${data.summary.updated}${data.errors && data.errors.length > 0 ? `. ${data.errors.length} errors occurred.` : ""}`,
          duration: 5000,
        });
      } else {
        toast.dismiss(syncToastId);
        toast.error("Sync Failed", {
          description: data.error || "Unknown error",
          duration: 8000,
        });
      }
    } catch (error) {
      console.error("Error syncing catalog:", error);
      const errorMsg = error instanceof Error ? error.message : "Network error";
      // Note: syncToastId may not be defined if error occurs before it's set
      // We'll just show the error without dismissing
      toast.error("Sync Error", {
        description: `${errorMsg}\n\nMake sure:\n1. Database tables exist (run schema.sql)\n2. Supabase credentials are configured\n3. You're connected to the internet`,
        duration: 10000,
      });
    } finally {
      setSyncing(false);
    }
  }, []);

  const generateTranscript = useCallback(async (sermon: Sermon | string) => {
    // Support both sermon object and sermon ID for batch operations
    const sermonId = typeof sermon === 'string' ? sermon : sermon.id
    const sermonObj = typeof sermon === 'string' 
      ? sermons.find(s => s.id === sermonId)
      : sermon
    
    if (!sermonObj) {
      toast.error("Sermon not found", {
        description: "The sermon could not be found.",
        duration: 3000,
      })
      return
    }
    
    const sermonToUse = sermonObj
    try {
      // Immediately update status to "generating" in UI
      setSermons((prev) =>
        prev.map((s) =>
          s.id === sermonToUse.id
            ? { ...s, status: "generating" as const, progress_json: { step: "queued", message: "Queued for transcription..." } }
            : s
        )
      );
      
      // Show loading toast
      toast.loading("Starting transcription...", {
        id: `transcript-${sermonToUse.id}`,
        description: "This may take several minutes. You can leave this page.",
      });
      
      // Fire and forget - don't wait for response
      fetch("/api/catalog/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sermonId: sermonToUse.id }),
      })
      .then(async (response) => {
        const data = await response.json().catch(() => ({ error: "Failed to parse response" }));

        if (!response.ok && response.status !== 200) {
          const errorMsg = data.error || `HTTP ${response.status}: ${response.statusText}`;
          
          // Dismiss loading toast
          toast.dismiss(`transcript-${sermonToUse.id}`);
          
          // Update sermon status to failed
          setSermons((prev) =>
            prev.map((s) =>
              s.id === sermonToUse.id
                ? { ...s, status: "failed" as const, error_message: errorMsg, progress_json: null }
                : s
            )
          );
          
          // Show error toast
          toast.error("Transcription Failed", {
            description: errorMsg,
            duration: 8000,
          });
          return;
        }

        // Dismiss loading toast
        toast.dismiss(`transcript-${sermonToUse.id}`);
        
        if (data.success && data.sermon) {
          // Update sermon in local state
          setSermons((prev) =>
            prev.map((s) => (s.id === sermonToUse.id ? data.sermon : s))
          );
          
          // If dialog is open for this sermon, update it
          if (selectedSermon?.id === sermonToUse.id) {
            setSelectedSermon(data.sermon);
          }
          
          // Show success toast if transcript completed
          if (data.sermon.status === "completed" && data.sermon.transcript) {
            analytics.transcriptGenerated(sermonToUse.id);
            toast.success("Transcript Generated", {
              description: `${data.sermon.transcript.length.toLocaleString()} characters transcribed`,
              duration: 4000,
            });
          }
        } else {
          // Handle case where transcript generation failed
          const errorMsg = data.error || "Unknown error";
          
          // Update sermon status to failed
          setSermons((prev) =>
            prev.map((s) =>
              s.id === sermonToUse.id
                ? { ...s, status: "failed" as const, error_message: errorMsg, progress_json: null }
                : s
            )
          );
          
          // Show error toast
          toast.error("Transcription Failed", {
            description: errorMsg,
            duration: 8000,
          });
        }
      })
      .catch((error) => {
        console.error("Error generating transcript:", error);
        const errorMsg = error instanceof Error ? error.message : "Network error";
        
        // Update sermon status to failed
        setSermons((prev) =>
          prev.map((s) =>
            s.id === sermonToUse.id
              ? { ...s, status: "failed" as const, error_message: errorMsg, progress_json: null }
              : s
          )
        );
      });
      
      // Show immediate feedback
      console.log(`[Generate] Transcription queued for "${sermonToUse.title}". You can leave this page and check back later.`);
      
    } catch (error) {
      console.error("Error queuing transcript:", error);
      const errorMsg = error instanceof Error ? error.message : "Network error";
      
      // Dismiss loading toast and show error
      toast.dismiss(`transcript-${sermonToUse.id}`);
      toast.error("Failed to Start Transcription", {
        description: errorMsg,
        duration: 6000,
      });
      
      // Update sermon status to failed
      setSermons((prev) =>
        prev.map((s) =>
          s.id === sermonToUse.id
            ? { ...s, status: "failed" as const, error_message: errorMsg, progress_json: null }
            : s
        )
      );
    }
  }, [sermons]);

  const handleCopyAll = useCallback(async (transcript: string) => {
    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      toast.success("Copied to clipboard", {
        description: `${transcript.length.toLocaleString()} characters copied`,
        duration: 2000,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Copy Failed", {
        description: "Please select and copy manually.",
        duration: 4000,
      });
    }
  }, []);

  const handleCloseSeriesDetail = useCallback(() => {
    setSelectedSeries(null);
  }, []);

  const handleSeriesClick = useCallback((series: SermonSeries) => {
    setSelectedSeries(series);
    // Scroll to top of detail view
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleViewSermon = useCallback((sermon: Sermon) => {
    // Track sermon view
    analytics.sermonViewed(sermon.id, sermon.title || 'Untitled');
    // Navigate to the dedicated sermon page instead of opening dialog
    router.push(`/sermons/${sermon.id}`);
  }, [router]);

  const handleViewSermonDialog = useCallback((sermon: Sermon, e?: React.MouseEvent) => {
    // Optional: Open in dialog (for quick previews)
    // Can be triggered by a button or modifier key
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Always use the latest sermon data from the sermons state to ensure we have all fields
    const latestSermon = sermons.find(s => s.id === sermon.id) || sermon;
    console.log('[View Sermon Dialog] Setting selected sermon:', latestSermon.id, 'youtube_url:', latestSermon.youtube_url ? 'YES' : 'NO', 'audio_url:', latestSermon.audio_url ? 'YES' : 'NO');
    setSelectedSermon(latestSermon);
  }, [sermons]);

  const handleSetAudioUrl = useCallback((sermon: Sermon) => {
    setAudioUrlDialogSermon(sermon);
    setAudioUrlDialogOpen(true);
  }, []);

  const updateAudioUrl = useCallback(async (sermon: Sermon, audioUrl: string, podbeanUrl?: string) => {
    try {
      setUpdatingAudio(true);
      
      const response = await fetch("/api/catalog/update-audio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sermonId: sermon.id,
          audioUrl: audioUrl || undefined,
          podbeanUrl: podbeanUrl || undefined,
          clearError: true, // Clear error message and reset status
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMsg = data.error || `HTTP ${response.status}`;
        toast.error("Update Failed", {
          description: `Failed to update audio URL: ${errorMsg}`,
          duration: 6000,
        });
        return;
      }

      // Update sermon in local state
      setSermons((prev) =>
        prev.map((s) => (s.id === sermon.id ? data.sermon : s))
      );
      
      // Update selected sermon if it's the same one
      if (selectedSermon?.id === sermon.id) {
        setSelectedSermon(data.sermon);
      }

      // Close override UI
      setShowAudioOverride(false);
      setAudioOverrideUrl("");
      
      toast.success("Audio URL Updated", {
        description: "You can now generate the transcript.",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error updating audio URL:", error);
      toast.error("Update Error", {
        description: error instanceof Error ? error.message : "Unknown error",
        duration: 6000,
      });
    } finally {
      setUpdatingAudio(false);
    }
  }, [selectedSermon]);

  const handleDownload = useCallback((sermon: Sermon) => {
    if (!sermon.transcript) {
      toast.error("No Transcript", {
        description: "This sermon doesn't have a transcript yet.",
        duration: 3000,
      });
      return;
    }

    try {
      const blob = new Blob([sermon.transcript], { type: "text/plain" });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${sermon.title || "transcript"}.txt`.replace(/[^a-z0-9]/gi, "_");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      
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
        const progressMessage = sermon.progress_json?.message || "Generating...";
        return (
          <Badge variant="secondary" className="gap-1" title={progressMessage}>
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

  return (
    <main className="relative min-h-screen">
      <SideNav />
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
      
      <div className="relative z-10">
        <HeroSection />
        
        {/* Series Detail View or Series List */}
        {selectedSeries ? (
          <SeriesDetailView
            series={selectedSeries}
            onClose={handleCloseSeriesDetail}
            onViewSermon={handleViewSermon}
            getStatusBadge={getStatusBadge}
            getSourceBadge={getSourceBadge}
          />
        ) : (
          <>
            {/* Actions */}
            <div className="relative py-6 sm:py-12 pl-4 sm:pl-6 md:pl-28 pr-4 sm:pr-6 md:pr-12 border-b border-border/30">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
                <Button
                  onClick={syncCatalog}
                  disabled={syncing}
                  variant="outline"
                  className="gap-2 border-foreground/20 font-mono text-xs uppercase tracking-widest hover:border-accent hover:text-accent"
                >
                  <RefreshCw className={syncing ? "animate-spin size-4" : "size-4"} />
                  {syncing ? "Syncing..." : "Sync Catalog"}
                </Button>
                <Button
                  onClick={loadSermons}
                  disabled={loading}
                  variant="ghost"
                  size="sm"
                  className="font-mono text-xs uppercase tracking-widest"
                >
                  Refresh
                </Button>
                {sermons.length > 0 && (
                  <>
                    <div className="text-xs sm:text-sm text-muted-foreground font-mono">
                      {sermons.length} {sermons.length === 1 ? "sermon" : "sermons"} • {sermonSeries.length} {sermonSeries.length === 1 ? "series" : "series"}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => {
                          const csv = exportToCSV(sermons);
                          downloadFile(csv, `sermons-export-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
                          analytics.batchOperation('export_csv', sermons.length);
                          toast.success("Export Started", {
                            description: "CSV file download started",
                            duration: 2000,
                          });
                        }}
                        variant="outline"
                        size="sm"
                        className="font-mono text-xs uppercase tracking-widest"
                      >
                        <Download className="size-3 mr-2" />
                        Export CSV
                      </Button>
                      <Button
                        onClick={() => {
                          const json = exportToJSON(sermons);
                          downloadFile(json, `sermons-export-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
                          analytics.batchOperation('export_json', sermons.length);
                          toast.success("Export Started", {
                            description: "JSON file download started",
                            duration: 2000,
                          });
                        }}
                        variant="outline"
                        size="sm"
                        className="font-mono text-xs uppercase tracking-widest"
                      >
                        <Download className="size-3 mr-2" />
                        Export JSON
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Loading State */}
            {loading ? (
              <div className="relative py-32 pl-6 md:pl-28 pr-6 md:pr-12">
                <div className="mb-16">
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Loading</span>
                  <h2 className="mt-4 font-[var(--font-bebas)] text-5xl md:text-7xl tracking-tight">SERIES</h2>
                </div>
                <div className="text-center text-muted-foreground font-mono text-sm">
                  Loading sermon catalog...
                </div>
              </div>
            ) : sermons.length === 0 ? (
              <div className="relative py-32 pl-6 md:pl-28 pr-6 md:pr-12">
                <div className="mb-16">
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Empty</span>
                  <h2 className="mt-4 font-[var(--font-bebas)] text-5xl md:text-7xl tracking-tight">NO SERIES</h2>
                </div>
                <div className="text-center text-muted-foreground font-mono text-sm mb-8">
                  No sermons in catalog yet.
                </div>
                <div className="text-center">
                  <Button onClick={syncCatalog} disabled={syncing} variant="outline" className="font-mono text-xs uppercase tracking-widest">
                    <RefreshCw className={syncing ? "animate-spin mr-2 size-4" : "mr-2 size-4"} />
                    Sync Catalog to Load Sermons
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Search and Filter Bar */}
                <section className="relative py-12 pl-6 md:pl-28 pr-6 md:pr-12 border-b border-border/30">
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                    {/* Search Input */}
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Search sermons by title, description, or transcript..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 font-mono text-sm"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </div>
                    
                    {/* Status Filter */}
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant={statusFilter === null ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStatusFilter(null)}
                        className="font-mono text-xs uppercase tracking-widest"
                      >
                        All ({sermons.length})
                      </Button>
                      <Button
                        variant={statusFilter === "pending" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStatusFilter("pending")}
                        className="font-mono text-xs uppercase tracking-widest"
                      >
                        Pending ({sermons.filter(s => s.status === "pending").length})
                      </Button>
                      <Button
                        variant={statusFilter === "generating" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStatusFilter("generating")}
                        className="font-mono text-xs uppercase tracking-widest"
                      >
                        Generating ({sermons.filter(s => s.status === "generating").length})
                      </Button>
                      <Button
                        variant={statusFilter === "completed" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStatusFilter("completed")}
                        className="font-mono text-xs uppercase tracking-widest"
                      >
                        Completed ({sermons.filter(s => s.status === "completed").length})
                      </Button>
                      <Button
                        variant={statusFilter === "failed" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStatusFilter("failed")}
                        className="font-mono text-xs uppercase tracking-widest"
                      >
                        Failed ({sermons.filter(s => s.status === "failed").length})
                      </Button>
                    </div>
                    
                    {/* Results count */}
                    {(searchQuery || statusFilter) && (
                      <div className="text-xs font-mono text-muted-foreground">
                        Showing {filteredSermons.length} of {sermons.length} sermons
                      </div>
                    )}
                  </div>
                </section>

                {/* Show John series if it exists */}
                {sermonSeries.length > 0 && (
                  <SermonSeriesSection series={sermonSeries} onSeriesClick={handleSeriesClick} />
                )}
                
                {/* Show ungrouped sermons after series */}
                {ungrouped.length > 0 && (
                  <section id="unsorted" className="relative py-16 sm:py-24 md:py-32 pl-4 sm:pl-6 md:pl-28 pr-4 sm:pr-6 md:pr-12">
                    <div className="mb-8 sm:mb-12 md:mb-16 pr-0 sm:pr-6 md:pr-12">
                      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">02 / Unsorted</span>
                      <h2 className="mt-4 font-[var(--font-bebas)] text-3xl sm:text-5xl md:text-7xl tracking-tight">UNSORTED SERMONS</h2>
                      <p className="mt-4 max-w-md font-mono text-xs text-muted-foreground leading-relaxed">
                        {ungrouped.length} {ungrouped.length === 1 ? "sermon" : "sermons"} • Not in any series
                      </p>
                    </div>
                    
                    {/* Batch Operations */}
                    {ungrouped.length > 0 && !loading && (
                      <div className="mb-4 sm:mb-6 pr-0 sm:pr-6 md:pr-12">
                        <BatchOperations
                          sermons={ungrouped}
                          onGenerate={async (sermonIds) => {
                            await Promise.all(sermonIds.map(id => generateTranscript(id)))
                          }}
                          onExport={(selectedSermons) => {
                            const csv = exportToCSV(selectedSermons)
                            downloadFile(csv, `sermons-export-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv')
                          }}
                        />
                      </div>
                    )}
                    
                    {/* Ungrouped sermons grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 pr-0 sm:pr-6 md:pr-12">
                      {loading ? (
                        // Show skeletons while loading
                        Array.from({ length: 6 }).map((_, i) => (
                          <SermonSkeleton key={`skeleton-${i}`} />
                        ))
                      ) : ungrouped.length === 0 && (searchQuery || statusFilter) ? (
                        <div className="col-span-full text-center py-16">
                          <p className="font-mono text-sm text-muted-foreground">
                            No sermons match your filters. Try adjusting your search or filter criteria.
                          </p>
                        </div>
                      ) : ungrouped.length === 0 ? (
                        <div className="col-span-full text-center py-16">
                          <p className="font-mono text-sm text-muted-foreground">
                            No unsorted sermons. Sync the catalog to load sermons.
                          </p>
                        </div>
                      ) : (
                        ungrouped.map((sermon) => (
                          <SermonCard
                            key={sermon.id}
                            sermon={sermon}
                            onClick={() => handleViewSermon(sermon)}
                            getStatusBadge={getStatusBadge}
                          />
                        ))
                      )}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}

        {/* Transcript Dialog */}
        <Dialog open={!!selectedSermon} onOpenChange={(open) => {
          if (!open) {
            setSelectedSermon(null);
            setShowAudioOverride(false);
            setAudioOverrideUrl("");
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-2xl">{selectedSermon?.title}</DialogTitle>
              {/* Debug info - remove after fixing */}
              {process.env.NODE_ENV === 'development' && selectedSermon && (
                <div className="text-xs font-mono text-muted-foreground mt-2 p-2 bg-muted rounded">
                  Debug: audio_url={selectedSermon.audio_url ? 'YES' : 'NO'}, 
                  youtube_url={selectedSermon.youtube_url ? 'YES' : 'NO'}
                  {selectedSermon.youtube_url && <span className="text-green-500"> ({selectedSermon.youtube_url.substring(0, 50)}...)</span>}
                </div>
              )}
              <DialogDescription className="flex items-center gap-4 flex-wrap">
                {selectedSermon?.date && (
                  <span className="flex items-center gap-1.5 text-xs font-mono">
                    <Calendar className="size-3" />
                    {format(new Date(selectedSermon.date), "MMMM d, yyyy")}
                  </span>
                )}
                {selectedSermon?.transcript_source && getSourceBadge(selectedSermon.transcript_source)}
                {selectedSermon?.podbean_url && selectedSermon.podbean_url.trim() && (
                  <a
                    href={selectedSermon.podbean_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-accent transition-colors cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (selectedSermon?.podbean_url) {
                        window.open(selectedSermon.podbean_url, '_blank', 'noopener,noreferrer')
                      }
                    }}
                  >
                    <ExternalLink className="size-3" />
                    Podbean
                  </a>
                )}
                {selectedSermon?.youtube_url && selectedSermon.youtube_url.trim() && (
                  <a
                    href={selectedSermon.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-accent transition-colors cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (selectedSermon?.youtube_url) {
                        window.open(selectedSermon.youtube_url, '_blank', 'noopener,noreferrer')
                      }
                    }}
                  >
                    <ExternalLink className="size-3" />
                    YouTube
                  </a>
                )}
              </DialogDescription>
            </DialogHeader>

            {selectedSermon?.transcript ? (
              <>
                <div className="flex-1 overflow-auto border rounded-lg p-4 bg-card">
                  <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-foreground">
                    {selectedSermon.transcript}
                  </pre>
                </div>

                <DialogFooter className="flex-row justify-between items-center">
                  <div className="text-xs text-muted-foreground font-mono">
                    {selectedSermon.transcript.length.toLocaleString()} characters
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectedSermon.transcript && handleCopyAll(selectedSermon.transcript)}
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 className="size-4" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="size-4" />
                          Copy All
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectedSermon && handleDownload(selectedSermon)}
                    >
                      <Download className="size-4" />
                      Download .txt
                    </Button>
                  </div>
                </DialogFooter>
              </>
            ) : selectedSermon?.progress_json?.completedChunks && Object.keys(selectedSermon.progress_json.completedChunks).length > 0 ? (
              <>
                {/* Show completed chunks if available, even without full transcript */}
                <div className="flex-1 overflow-auto space-y-4">
                  <div className="border rounded-lg p-4 bg-card/50">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-semibold font-mono uppercase tracking-widest mb-1">
                          Completed Chunks
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {Object.keys(selectedSermon.progress_json.completedChunks).length}
                          {selectedSermon.progress_json.total && ` / ${selectedSermon.progress_json.total}`} chunks completed
                        </p>
                      </div>
                      {selectedSermon.progress_json.failedChunks && 
                       Object.keys(selectedSermon.progress_json.failedChunks).length > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {Object.keys(selectedSermon.progress_json.failedChunks).length} failed
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      {Object.entries(selectedSermon.progress_json.completedChunks)
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
                                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground max-h-64 overflow-auto">
                                    {chunkText}
                                  </pre>
                                  <div className="mt-3 flex gap-2">
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
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-6">
                {/* Audio URL Override Section - Only show if no audio_url AND no youtube_url */}
                {/* If youtube_url exists, worker can handle it automatically */}
                {((!selectedSermon?.audio_url && !selectedSermon?.youtube_url) || 
                 (selectedSermon.status === "failed" && !selectedSermon?.youtube_url && !selectedSermon?.audio_url)) ? (
                  <div className="border rounded-lg p-4 bg-card">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-semibold font-mono uppercase tracking-widest mb-1">
                          {selectedSermon?.audio_url ? "Update Audio URL" : "Manual Audio URL Override"}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {selectedSermon?.audio_url 
                            ? "Update the audio URL if the current one is incorrect."
                            : "Paste a Podbean episode URL or direct MP3/M4A URL to enable transcript generation."}
                        </p>
                      </div>
                      {!showAudioOverride && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="font-mono text-xs uppercase tracking-widest"
                          onClick={() => {
                            setShowAudioOverride(true);
                            setAudioOverrideUrl(selectedSermon?.audio_url || "");
                          }}
                        >
                          <Link2 className="size-3 mr-2" />
                          {selectedSermon?.audio_url ? "Update" : "Set Audio URL"}
                        </Button>
                      )}
                    </div>

                    {showAudioOverride && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1.5 block">
                            Audio URL or Podbean Episode URL
                          </label>
                          <Input
                            type="url"
                            placeholder="https://... (MP3/M4A URL or Podbean episode URL)"
                            value={audioOverrideUrl}
                            onChange={(e) => setAudioOverrideUrl(e.target.value)}
                            className="font-mono text-xs"
                            disabled={updatingAudio}
                          />
                          <p className="text-xs text-muted-foreground mt-1.5">
                            Paste either: (1) Direct MP3/M4A URL, or (2) Podbean episode URL (we'll extract the audio URL)
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="font-mono text-xs uppercase tracking-widest"
                            onClick={() => {
                              if (!audioOverrideUrl.trim()) {
                                toast.error("Invalid Input", {
                                  description: "Please enter an audio URL or Podbean episode URL",
                                  duration: 4000,
                                });
                                return;
                              }
                              
                              // Check if it's a Podbean URL or direct audio URL
                              const isPodbeanUrl = audioOverrideUrl.includes("podbean.com");
                              const isDirectAudio = /\.(mp3|m4a|wav|ogg)(\?|$)/i.test(audioOverrideUrl);
                              
                              if (!isPodbeanUrl && !isDirectAudio) {
                                toast.warning("URL Warning", {
                                  description: "This doesn't look like a Podbean URL or direct audio URL. Continue anyway?",
                                  action: {
                                    label: "Continue",
                                    onClick: () => {
                                      updateAudioUrl(
                                        selectedSermon!,
                                        isDirectAudio ? audioOverrideUrl : "",
                                        isPodbeanUrl ? audioOverrideUrl : undefined
                                      );
                                    },
                                  },
                                  cancel: {
                                    label: "Cancel",
                                    onClick: () => {},
                                  },
                                  duration: 8000,
                                });
                                return;
                              }
                              
                              updateAudioUrl(
                                selectedSermon!,
                                isDirectAudio ? audioOverrideUrl : "",
                                isPodbeanUrl ? audioOverrideUrl : undefined
                              );
                            }}
                            disabled={updatingAudio || !audioOverrideUrl.trim()}
                          >
                            {updatingAudio ? (
                              <>
                                <Loader2 className="size-3 mr-2 animate-spin" />
                                Updating...
                              </>
                            ) : (
                              <>
                                <Save className="size-3 mr-2" />
                                Save Audio URL
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="font-mono text-xs uppercase tracking-widest"
                            onClick={() => {
                              setShowAudioOverride(false);
                              setAudioOverrideUrl("");
                            }}
                            disabled={updatingAudio}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {selectedSermon?.audio_url && !showAudioOverride && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <p className="text-xs text-muted-foreground font-mono">
                          Current: <span className="text-foreground/70 break-all">{selectedSermon.audio_url.substring(0, 80)}{selectedSermon.audio_url.length > 80 ? '...' : ''}</span>
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Generate Transcript Button */}
                <div className="text-center">
                  {selectedSermon?.status === "failed" && selectedSermon?.error_message && (
                    <div className="mb-4 p-3 border border-destructive/50 rounded-lg bg-destructive/5">
                      <p className="text-sm text-destructive font-mono whitespace-pre-wrap text-left">
                        {selectedSermon.error_message}
                      </p>
                    </div>
                  )}
                  
                  {selectedSermon && (
                    <>
                      {/* Progress Display */}
                      {selectedSermon.status === "generating" && selectedSermon.progress_json?.message && (
                        <div className="mb-4 p-4 border border-border/30 rounded-lg bg-card/50">
                          <div className="flex items-start gap-3">
                            <Loader2 className="size-4 animate-spin text-accent mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-mono text-muted-foreground">
                                {selectedSermon.progress_json.message}
                                {selectedSermon.progress_json.current && selectedSermon.progress_json.total && (
                                  <span className="ml-2 text-xs text-muted-foreground/70">
                                    ({selectedSermon.progress_json.current}/{selectedSermon.progress_json.total})
                                  </span>
                                )}
                              </p>
                              {/* Show completed chunks if available */}
                              {selectedSermon.progress_json.completedChunks && 
                               Object.keys(selectedSermon.progress_json.completedChunks).length > 0 && (
                                <div className="mt-2 pt-2 border-t border-border/30">
                                  <p className="text-xs font-mono text-muted-foreground mb-1">
                                    ✅ Completed chunks: {Object.keys(selectedSermon.progress_json.completedChunks).length}
                                    {selectedSermon.progress_json.total && 
                                     ` / ${selectedSermon.progress_json.total}`}
                                  </p>
                                  {selectedSermon.progress_json.failedChunks && 
                                   Object.keys(selectedSermon.progress_json.failedChunks).length > 0 && (
                                    <p className="text-xs font-mono text-destructive/70 mb-1">
                                      ❌ Failed chunks: {Object.keys(selectedSermon.progress_json.failedChunks).length}
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground/70 italic">
                                    Progress is saved automatically. If transcription fails, you can retry and it will resume from the last completed chunk.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <Button
                        className="font-mono text-xs uppercase tracking-widest"
                        onClick={() => selectedSermon && generateTranscript(selectedSermon)}
                        disabled={selectedSermon.status === "generating" || (!selectedSermon.audio_url && !selectedSermon.youtube_url)}
                        variant={!selectedSermon.audio_url && !selectedSermon.youtube_url ? "outline" : "default"}
                      >
                        {selectedSermon.status === "generating" ? (
                          <>
                            <Loader2 className="size-4 animate-spin mr-2" />
                            Generating... (you can leave)
                          </>
                        ) : !selectedSermon.audio_url && !selectedSermon.youtube_url ? (
                          <>
                            <AlertCircle className="size-4 mr-2" />
                            No Audio URL - Set Above First
                          </>
                        ) : selectedSermon.youtube_url && !selectedSermon.audio_url ? (
                          <>
                            <Play className="size-4 mr-2" />
                            Generate from YouTube
                          </>
                        ) : (
                          <>
                            <Play className="size-4 mr-2" />
                            Generate Transcript
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Audio URL Dialog - Simple modal for setting audio URL */}
        <AudioUrlDialog
          sermon={audioUrlDialogSermon}
          open={audioUrlDialogOpen}
          onOpenChange={(open) => {
            setAudioUrlDialogOpen(open);
            if (!open) {
              setAudioUrlDialogSermon(null);
            }
          }}
          onSave={updateAudioUrl}
        />
      </div>
    </main>
  );
}
