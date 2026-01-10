"use client";

import { useState, useEffect, useMemo } from "react";
import { RefreshCw, Play, Copy, Download, CheckCircle2, AlertCircle, Loader2, Calendar, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { HeroSection } from "@/components/hero-section";
import { SideNav } from "@/components/side-nav";
import { SermonSeriesSection } from "@/components/sermon-series-section";
import { SeriesDetailView } from "@/components/series-detail-view";
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

  // Group sermons by series
  const { series: sermonSeries, ungrouped } = useMemo(() => {
    return groupSermonsBySeries(sermons);
  }, [sermons]);

  // Load sermons on mount
  useEffect(() => {
    loadSermons();
  }, []);

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

  const handleViewTranscript = (sermon: Sermon) => {
    setSelectedSermon(sermon);
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
            onGenerateTranscript={generateTranscript}
            onViewTranscript={handleViewTranscript}
            onDownload={handleDownload}
            onCopyTranscript={handleCopyAll}
            generating={generating}
            getStatusBadge={getStatusBadge}
            getSourceBadge={getSourceBadge}
            copied={copied}
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
            ) : sermonSeries.length > 0 ? (
              <SermonSeriesSection series={sermonSeries} onSeriesClick={handleSeriesClick} />
            ) : (
              <div className="relative py-32 pl-6 md:pl-28 pr-6 md:pr-12">
                <div className="mb-16">
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">No Series</span>
                  <h2 className="mt-4 font-[var(--font-bebas)] text-5xl md:text-7xl tracking-tight">NO SERIES FOUND</h2>
                </div>
                <div className="text-center text-muted-foreground font-mono text-sm">
                  Sermons found but unable to organize into series. Sermons may need title formatting.
                </div>
              </div>
            )}
          </>
        )}

        {/* Transcript Dialog */}
        <Dialog open={!!selectedSermon} onOpenChange={(open) => !open && setSelectedSermon(null)}>
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
                {selectedSermon?.podbean_url && (
                  <a
                    href={selectedSermon.podbean_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-accent transition-colors"
                  >
                    <ExternalLink className="size-3" />
                    Podbean
                  </a>
                )}
                {selectedSermon?.youtube_url && (
                  <a
                    href={selectedSermon.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-accent transition-colors"
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
              <div className="py-12 text-center text-muted-foreground">
                <p>No transcript available for this sermon.</p>
                {selectedSermon && (
                  <Button
                    className="mt-4"
                    onClick={() => selectedSermon && generateTranscript(selectedSermon)}
                    disabled={generating.has(selectedSermon.id)}
                  >
                    {generating.has(selectedSermon.id) ? (
                      <>
                        <Loader2 className="size-4 animate-spin mr-2" />
                        Generating...
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
            )}
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
