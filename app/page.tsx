"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Play, Copy, Download, CheckCircle2, AlertCircle, Loader2, Calendar, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sermon } from "@/lib/supabase";
import { format } from "date-fns";

export default function Home() {
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedSermon, setSelectedSermon] = useState<Sermon | null>(null);
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  // Load sermons on mount
  useEffect(() => {
    loadSermons();
  }, []);

  const loadSermons = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/catalog/list");
      const data = await response.json();
      setSermons(data.sermons || []);
    } catch (error) {
      console.error("Error loading sermons:", error);
    } finally {
      setLoading(false);
    }
  };

  const syncCatalog = async () => {
    try {
      setSyncing(true);
      const response = await fetch("/api/catalog/sync");
      const data = await response.json();
      
      if (data.success) {
        // Reload sermons after sync
        await loadSermons();
        alert(`Catalog synced! Found ${data.summary.matchedSermons} sermons. Created: ${data.summary.created}, Updated: ${data.summary.updated}`);
      } else {
        alert("Sync failed: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error syncing catalog:", error);
      alert("Error syncing catalog. Please try again.");
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

      const data = await response.json();

      if (data.success && data.sermon) {
        // Update sermon in local state
        setSermons((prev) =>
          prev.map((s) => (s.id === sermon.id ? data.sermon : s))
        );
        setSelectedSermon(data.sermon);
      } else {
        alert("Failed to generate transcript: " + (data.error || "Unknown error"));
        // Update sermon status to failed
        setSermons((prev) =>
          prev.map((s) =>
            s.id === sermon.id
              ? { ...s, status: "failed" as const, error_message: data.error }
              : s
          )
        );
      }
    } catch (error) {
      console.error("Error generating transcript:", error);
      alert("Error generating transcript. Please try again.");
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
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
      
      <div className="relative z-10 container mx-auto px-4 md:px-8 py-12 md:py-16">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            FX Transcriptor
          </h1>
          <p className="text-muted-foreground text-lg font-light">
            Sermon Transcript Catalog • 818 Episodes Available
          </p>
        </div>

        {/* Actions */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="flex gap-2 items-center">
            <Button
              onClick={syncCatalog}
              disabled={syncing}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing..." : "Sync Catalog"}
            </Button>
            <Button
              onClick={loadSermons}
              disabled={loading}
              variant="ghost"
              size="sm"
            >
              Refresh
            </Button>
          </div>
          <div className="text-sm text-muted-foreground font-mono">
            {sermons.length} {sermons.length === 1 ? "sermon" : "sermons"} in catalog
          </div>
        </div>

        {/* Sermon List */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-9 w-24" />
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : sermons.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-muted-foreground mb-4">No sermons in catalog yet.</p>
              <Button onClick={syncCatalog} disabled={syncing} variant="outline">
                <RefreshCw className={syncing ? "animate-spin mr-2" : "mr-2"} />
                Sync Catalog to Load Sermons
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sermons.map((sermon) => (
              <Card key={sermon.id} className="hover:border-accent transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base font-semibold mb-2 line-clamp-2">
                        {sermon.title}
                      </CardTitle>
                      {sermon.date && (
                        <CardDescription className="flex items-center gap-1.5 text-xs font-mono">
                          <Calendar className="size-3" />
                          {format(new Date(sermon.date), "MMM d, yyyy")}
                        </CardDescription>
                      )}
                    </div>
                    <CardAction>
                      {getStatusBadge(sermon)}
                    </CardAction>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {sermon.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {sermon.description}
                    </p>
                  )}
                  
                  <div className="flex flex-wrap gap-2">
                    {sermon.transcript_source && getSourceBadge(sermon.transcript_source)}
                    {sermon.podbean_url && (
                      <Badge variant="outline" className="gap-1">
                        <ExternalLink className="size-3" />
                        Podbean
                      </Badge>
                    )}
                    {sermon.youtube_url && (
                      <Badge variant="outline" className="gap-1">
                        <ExternalLink className="size-3" />
                        YouTube
                      </Badge>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col sm:flex-row gap-2">
                  {sermon.transcript ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() => setSelectedSermon(sermon)}
                      >
                        <Play className="size-4" />
                        View Transcript
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(sermon)}
                      >
                        <Download className="size-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant={sermon.status === "generating" ? "secondary" : "default"}
                      size="sm"
                      className="w-full gap-2"
                      disabled={generating.has(sermon.id) || sermon.status === "generating"}
                      onClick={() => generateTranscript(sermon)}
                    >
                      {generating.has(sermon.id) || sermon.status === "generating" ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Generating...
                        </>
                      ) : sermon.status === "failed" ? (
                        <>
                          <AlertCircle className="size-4" />
                          Retry Generate
                        </>
                      ) : (
                        <>
                          <Play className="size-4" />
                          Generate Transcript
                        </>
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
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
