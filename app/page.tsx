"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Play, Copy, Download, CheckCircle2, AlertCircle, Loader2, Calendar, ExternalLink, Link2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { HeroSection } from "@/components/hero-section";
import { SideNav } from "@/components/side-nav";
import { SermonSeriesSection } from "@/components/sermon-series-section";
import { SeriesDetailView } from "@/components/series-detail-view";
import { AudioUrlDialog } from "@/components/audio-url-dialog";
import { Sermon } from "@/lib/supabase";
import { groupSermonsBySeries, SermonSeries } from "@/lib/extractSeries";
import { format } from "date-fns";

export default function Home() {
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedSermon, setSelectedSermon] = useState<Sermon | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<SermonSeries | null>(null);
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [playlistSeriesMap, setPlaylistSeriesMap] = useState<Map<string, string>>(new Map());
  const [showAudioOverride, setShowAudioOverride] = useState(false);
  const [audioOverrideUrl, setAudioOverrideUrl] = useState("");
  const [updatingAudio, setUpdatingAudio] = useState(false);
  const [audioUrlDialogOpen, setAudioUrlDialogOpen] = useState(false);
  const [audioUrlDialogSermon, setAudioUrlDialogSermon] = useState<Sermon | null>(null);

  // Group sermons by series (using playlist data if available)
  const { series: sermonSeries, ungrouped } = useMemo(() => {
    return groupSermonsBySeries(sermons, playlistSeriesMap);
  }, [sermons, playlistSeriesMap]);

  // Load sermons and playlists on mount
  useEffect(() => {
    loadSermons();
    loadPlaylistSeries();
  }, []);

  const loadPlaylistSeries = async () => {
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
          for (const sermonId of playlist.sermonIds || []) {
            // Use playlist title as series name (already cleaned by API)
            seriesMap.set(sermonId, playlist.seriesName);
          }
        }
        
        setPlaylistSeriesMap(seriesMap);
        console.log(`[Playlist Series] Loaded ${seriesMap.size} sermon-series mappings from ${data.playlists.length} playlists`);
      }
    } catch (error) {
      console.warn("Error loading playlist series data (non-critical):", error);
      // Don't block the app if playlist fetch fails - fallback to title extraction
    }
  };

  const loadSermons = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/catalog/list");
      
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
      setSermons(data.sermons || []);
      
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
  };

  const syncCatalog = async () => {
    try {
      setSyncing(true);
      const response = await fetch("/api/catalog/sync");
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        const details = errorData.details ? `\n\nDetails: ${errorData.details}` : "";
        
        if (errorMsg.includes("tables not found") || errorMsg.includes("schema")) {
          alert(`❌ Database Setup Required\n\n${errorMsg}${details}\n\nPlease run the schema.sql file in your Supabase SQL Editor.`);
        } else {
          alert(`Sync failed: ${errorMsg}${details}`);
        }
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Reload sermons after sync
        await loadSermons();
        alert(`✅ Catalog synced!\n\nFound ${data.summary.matchedSermons} sermons.\nCreated: ${data.summary.created}\nUpdated: ${data.summary.updated}${data.errors && data.errors.length > 0 ? `\n\nErrors: ${data.errors.length}` : ""}`);
      } else {
        alert("Sync failed: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error syncing catalog:", error);
      const errorMsg = error instanceof Error ? error.message : "Network error";
      alert(`Error syncing catalog: ${errorMsg}\n\nMake sure:\n1. Database tables exist (run schema.sql)\n2. Supabase credentials are configured\n3. You're connected to the internet`);
    } finally {
      setSyncing(false);
    }
  };

  const generateTranscript = async (sermon: Sermon) => {
    try {
      setGenerating((prev) => new Set(prev).add(sermon.id));
      
      const response = await fetch("/api/catalog/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sermonId: sermon.id }),
      });

      const data = await response.json().catch(() => ({ error: "Failed to parse response" }));

      if (!response.ok && response.status !== 200) {
        const errorMsg = data.error || `HTTP ${response.status}: ${response.statusText}`;
        const details = data.details ? `\n\nDetails: ${data.details}` : "";
        
        if (errorMsg.includes("not found") && !errorMsg.includes("tables")) {
          alert(`Sermon not found: ${errorMsg}\n\nTry syncing the catalog first.`);
        } else if (errorMsg.includes("tables not found") || errorMsg.includes("schema")) {
          alert(`❌ Database Setup Required\n\n${errorMsg}${details}\n\nPlease run the schema.sql file in your Supabase SQL Editor.`);
        } else {
          alert(`Failed to generate transcript: ${errorMsg}${details}`);
        }
        
        // Update sermon status to failed
        setSermons((prev) =>
          prev.map((s) =>
            s.id === sermon.id
              ? { ...s, status: "failed" as const, error_message: errorMsg }
              : s
          )
        );
        return;
      }

      if (data.success && data.sermon) {
        // Update sermon in local state
        setSermons((prev) =>
          prev.map((s) => (s.id === sermon.id ? data.sermon : s))
        );
        setSelectedSermon(data.sermon);
      } else {
        // Handle case where transcript generation failed (status 200, but success: false)
        const errorMsg = data.error || "Unknown error";
        const attemptedUrls = data.attemptedUrls ? `\n\n${data.attemptedUrls.map((u: string) => `• ${u}`).join('\n')}` : '';
        
        // More helpful error message
        let userMessage = `Failed to generate transcript: ${errorMsg}${attemptedUrls}`;
        
        if (!sermon.youtube_url && !sermon.podbean_url) {
          userMessage = "No YouTube or Podbean URL available for this sermon. Cannot generate transcript.";
        } else if (errorMsg.includes("Unable to extract transcript") || errorMsg.includes("Unable to extract captions")) {
          userMessage = `Unable to extract transcript from this sermon.${attemptedUrls}\n\nPossible reasons:\n• YouTube captions load via JavaScript (not accessible to automated tools)\n• Video captions require authentication\n• Podbean episode has no transcript\n\nSolutions:\n• YouTube Data API v3 can access these captions (requires free API key)\n• Whisper AI transcription can generate transcript from audio (free via Hugging Face)\n• See YOUTUBE_CAPTION_LIMITATION.md for details\n\nNote: Even if you can see captions on YouTube, they may not be accessible to automated extraction.`;
        }
        
        alert(userMessage);
        
        // Update sermon status to failed
        setSermons((prev) =>
          prev.map((s) =>
            s.id === sermon.id
              ? { ...s, status: "failed" as const, error_message: errorMsg }
              : s
          )
        );
      }
    } catch (error) {
      console.error("Error generating transcript:", error);
      const errorMsg = error instanceof Error ? error.message : "Network error";
      alert(`Error generating transcript: ${errorMsg}\n\nMake sure you're connected to the internet and the server is running.`);
      
      // Update sermon status to failed
      setSermons((prev) =>
        prev.map((s) =>
          s.id === sermon.id
            ? { ...s, status: "failed" as const, error_message: errorMsg }
            : s
        )
      );
    } finally {
      setGenerating((prev) => {
        const next = new Set(prev);
        next.delete(sermon.id);
        return next;
      });
    }
  };

  const handleCopyAll = async (transcript: string) => {
    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert("Failed to copy to clipboard. Please select and copy manually.");
    }
  };

  const handleSeriesClick = (series: SermonSeries) => {
    setSelectedSeries(series);
    // Scroll to top of detail view
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCloseSeriesDetail = () => {
    setSelectedSeries(null);
  };

  const handleViewSermon = (sermon: Sermon) => {
    router.push(`/sermons/${sermon.id}`);
  };

  const handleSetAudioUrl = (sermon: Sermon) => {
    setAudioUrlDialogSermon(sermon);
    setAudioUrlDialogOpen(true);
  };

  const updateAudioUrl = async (sermon: Sermon, audioUrl: string, podbeanUrl?: string) => {
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
        alert(`Failed to update audio URL: ${errorMsg}`);
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
      
      alert(`✅ Audio URL updated successfully! You can now generate the transcript.`);
    } catch (error) {
      console.error("Error updating audio URL:", error);
      alert(`Error updating audio URL: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setUpdatingAudio(false);
    }
  };

  const handleDownload = (sermon: Sermon) => {
    if (!sermon.transcript) return;

    const blob = new Blob([sermon.transcript], { type: "text/plain" });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `${sermon.title || "transcript"}.txt`.replace(/[^a-z0-9]/gi, "_");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  };

  const getStatusBadge = (sermon: Sermon) => {
    switch (sermon.status) {
      case "completed":
        return <Badge variant="default">Completed</Badge>;
      case "generating":
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="size-3 animate-spin" />
            Generating
          </Badge>
        );
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const getSourceBadge = (source: string | null) => {
    if (!source) return null;
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      youtube: { label: "YouTube", variant: "default" },
      podbean: { label: "Podbean", variant: "secondary" },
      apple: { label: "Apple", variant: "outline" },
      generated: { label: "Generated", variant: "outline" },
    };
    const config = variants[source] || { label: source, variant: "outline" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

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
            <div className="relative py-12 pl-6 md:pl-28 pr-6 md:pr-12 border-b border-border/30">
              <div className="flex flex-col sm:flex-row gap-4 items-center">
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
                  <div className="text-sm text-muted-foreground font-mono">
                    {sermons.length} {sermons.length === 1 ? "sermon" : "sermons"} • {sermonSeries.length} {sermonSeries.length === 1 ? "series" : "series"}
                  </div>
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
                {/* Show John series if it exists */}
                {sermonSeries.length > 0 && (
                  <SermonSeriesSection series={sermonSeries} onSeriesClick={handleSeriesClick} />
                )}
                
                {/* Show ungrouped sermons after series */}
                {ungrouped.length > 0 && (
                  <section id="unsorted" className="relative py-32 pl-6 md:pl-28 pr-6 md:pr-12">
                    <div className="mb-16 pr-6 md:pr-12">
                      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">02 / Unsorted</span>
                      <h2 className="mt-4 font-[var(--font-bebas)] text-5xl md:text-7xl tracking-tight">UNSORTED SERMONS</h2>
                      <p className="mt-4 max-w-md font-mono text-xs text-muted-foreground leading-relaxed">
                        {ungrouped.length} {ungrouped.length === 1 ? "sermon" : "sermons"} • Not in any series
                      </p>
                    </div>
                    
                    {/* Ungrouped sermons grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pr-6 md:pr-12">
                      {ungrouped.map((sermon) => (
                        <article
                          key={sermon.id}
                          className="group border border-border/30 p-6 hover:border-accent/50 transition-all duration-200 cursor-pointer"
                          onClick={() => handleViewSermon(sermon)}
                        >
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <h3 className="font-[var(--font-bebas)] text-xl tracking-tight line-clamp-2 flex-1 group-hover:text-accent transition-colors">
                              {sermon.title}
                            </h3>
                            {getStatusBadge(sermon)}
                          </div>
                          
                          {sermon.date && (
                            <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground mb-4">
                              <Calendar className="size-3" />
                              {format(new Date(sermon.date), "MMMM d, yyyy")}
                            </div>
                          )}
                          
                          {sermon.transcript && (
                            <div className="mt-4">
                              <span className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground">
                                <CheckCircle2 className="size-3" />
                                Transcript available
                              </span>
                            </div>
                          )}
                        </article>
                      ))}
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
            ) : (
              <div className="flex flex-col gap-6">
                {/* Audio URL Override Section */}
                {(!selectedSermon?.audio_url || selectedSermon.status === "failed") && (
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
                                alert("Please enter an audio URL or Podbean episode URL");
                                return;
                              }
                              
                              // Check if it's a Podbean URL or direct audio URL
                              const isPodbeanUrl = audioOverrideUrl.includes("podbean.com");
                              const isDirectAudio = /\.(mp3|m4a|wav|ogg)(\?|$)/i.test(audioOverrideUrl);
                              
                              if (!isPodbeanUrl && !isDirectAudio) {
                                if (!confirm("This doesn't look like a Podbean URL or direct audio URL. Continue anyway?")) {
                                  return;
                                }
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
                )}

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
                    <Button
                      className="font-mono text-xs uppercase tracking-widest"
                      onClick={() => selectedSermon && generateTranscript(selectedSermon)}
                      disabled={generating.has(selectedSermon.id) || !selectedSermon.audio_url}
                      variant={!selectedSermon.audio_url ? "outline" : "default"}
                    >
                      {generating.has(selectedSermon.id) ? (
                        <>
                          <Loader2 className="size-4 animate-spin mr-2" />
                          Generating...
                        </>
                      ) : !selectedSermon.audio_url ? (
                        <>
                          <AlertCircle className="size-4 mr-2" />
                          No Audio URL - Set Above First
                        </>
                      ) : (
                        <>
                          <Play className="size-4 mr-2" />
                          Generate Transcript
                        </>
                      )}
                    </Button>
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
