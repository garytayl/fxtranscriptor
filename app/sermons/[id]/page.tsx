"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, ExternalLink, Play, Download, Copy, CheckCircle2, AlertCircle, Loader2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Sermon } from "@/lib/supabase";
import { AudioUrlDialog } from "@/components/audio-url-dialog";

interface TranscriptionProgress {
  step: string;
  current?: number;
  total?: number;
  message?: string;
}

export default function SermonDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const router = useRouter();
  const [sermon, setSermon] = useState<Sermon | null>(null);
  const [sermonId, setSermonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<TranscriptionProgress | null>(null);
  const [copied, setCopied] = useState(false);
  const [audioUrlDialogOpen, setAudioUrlDialogOpen] = useState(false);

  // Extract ID from params (handle both Promise and direct params)
  useEffect(() => {
    const extractId = async () => {
      try {
        let id: string;
        if (params && typeof params === 'object' && 'then' in params && typeof (params as any).then === 'function') {
          const resolved = await (params as Promise<{ id: string }>);
          id = resolved.id;
        } else {
          id = (params as { id: string }).id;
        }
        if (id) {
          setSermonId(id);
        }
      } catch (error) {
        console.error("Error extracting ID from params:", error);
        setLoading(false);
      }
    };
    extractId();
  }, [params]);

  // Poll for updates when generating
  useEffect(() => {
    if (!generating || !sermon) return;

    const interval = setInterval(async () => {
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
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [generating, sermon]);

  useEffect(() => {
    if (sermonId) {
      loadSermon(sermonId);
    }
  }, [sermonId]);

  const loadSermon = async (id: string) => {
    try {
      setLoading(true);
      if (!id) {
        throw new Error("Missing sermon ID");
      }
      
      const response = await fetch(`/api/catalog/${id}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load sermon");
      }

      const data = await response.json();
      
      if (!data.sermon) {
        throw new Error("Sermon not found");
      }

      setSermon(data.sermon);
      setGenerating(data.sermon.status === "generating");
      if (data.sermon.progress_json) {
        setProgress(data.sermon.progress_json);
      }
    } catch (error) {
      console.error("Error loading sermon:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateTranscript = async () => {
    if (!sermon || generating) return;

    setGenerating(true);
    setProgress({ step: "starting", message: "Initializing transcription..." });

    try {
      // Update progress
      setProgress({ step: "checking", message: "Checking audio file size..." });

      const response = await fetch("/api/catalog/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sermonId: sermon.id }),
      });

      const data = await response.json();

      if (data.success && data.sermon) {
        setSermon(data.sermon);
        setProgress(null);
        setGenerating(false);
      } else {
        // Parse error to show progress
        const errorMsg = data.error || "Unknown error";
        
        if (errorMsg.includes("timeout") || errorMsg.includes("timed out")) {
          setProgress({
            step: "timeout",
            message: "Transcription is taking longer than expected. It may continue in the background. Please refresh the page to check status.",
          });
        } else {
          setProgress({
            step: "error",
            message: errorMsg,
          });
        }
        
        setGenerating(false);
        // Reload sermon to get updated status
        if (sermonId) {
          await loadSermon(sermonId);
        }
      }
    } catch (error) {
      console.error("Error generating transcript:", error);
      setProgress({
        step: "error",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      });
      setGenerating(false);
    }
  };

  const handleCopyAll = async () => {
    if (!sermon?.transcript) return;
    
    try {
      await navigator.clipboard.writeText(sermon.transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleDownload = () => {
    if (!sermon?.transcript) return;
    
    const blob = new Blob([sermon.transcript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sermon.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const updateAudioUrl = async (sermon: Sermon, audioUrl: string, podbeanUrl?: string) => {
    try {
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
      
      if (data.success && data.sermon) {
        setSermon(data.sermon);
        setAudioUrlDialogOpen(false);
      } else {
        throw new Error(data.error || "Failed to update audio URL");
      }
    } catch (error) {
      console.error("Error updating audio URL:", error);
      throw error;
    }
  };

  const getStatusBadge = (sermon: Sermon) => {
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

  if (loading) {
    return (
      <main className="relative min-h-screen">
        <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
        <div className="relative z-10 py-32 pl-6 md:pl-28 pr-6 md:pr-12">
          <div className="text-center text-muted-foreground font-mono text-sm">
            Loading sermon...
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
      
      <div className="relative z-10 py-12 pl-6 md:pl-28 pr-6 md:pr-12">
        {/* Back Button */}
        <Button
          onClick={() => router.push("/")}
          variant="ghost"
          size="sm"
          className="mb-8 font-mono text-xs uppercase tracking-widest gap-2 hover:text-accent"
        >
          <ArrowLeft className="size-4" />
          Back to Catalog
        </Button>

        {/* Header */}
        <div className="mb-12">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Sermon Detail</span>
          <h1 className="mt-4 font-[var(--font-bebas)] text-4xl md:text-6xl tracking-tight mb-6">
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

        {/* Description */}
        {sermon.description && (
          <div className="mb-12 max-w-3xl">
            <p className="font-mono text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {sermon.description}
            </p>
          </div>
        )}

        {/* Progress Display */}
        {(generating || progress) && (
          <div className="mb-12 p-6 border border-border/30 rounded-lg bg-card/50">
            <div className="flex items-start gap-4">
              <Loader2 className="size-5 animate-spin text-accent mt-0.5" />
              <div className="flex-1">
                <h3 className="font-mono text-sm uppercase tracking-widest mb-2">Transcription Progress</h3>
                {progress?.message && (
                  <p className="text-sm text-muted-foreground font-mono">{progress.message}</p>
                )}
                {!progress?.message && sermon.status === "generating" && (
                  <p className="text-sm text-muted-foreground font-mono">Processing... Please wait.</p>
                )}
              </div>
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
        <div className="mb-12 flex flex-wrap gap-4">
          {!sermon.audio_url && (
            <Button
              variant="outline"
              size="lg"
              className="font-mono text-xs uppercase tracking-widest border-amber-500/50 hover:border-amber-500 hover:text-amber-500"
              onClick={() => setAudioUrlDialogOpen(true)}
            >
              <Link2 className="size-4 mr-2" />
              Set Audio URL
            </Button>
          )}
          
          {sermon.transcript ? (
            <>
              <Button
                variant="default"
                size="lg"
                className="font-mono text-xs uppercase tracking-widest gap-2"
                onClick={handleCopyAll}
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="size-4" />
                    Copied!
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
                size="lg"
                className="font-mono text-xs uppercase tracking-widest gap-2"
                onClick={handleDownload}
              >
                <Download className="size-4" />
                Download .txt
              </Button>
            </>
          ) : (
            <Button
              variant={sermon.status === "generating" ? "secondary" : "default"}
              size="lg"
              className="font-mono text-xs uppercase tracking-widest gap-2"
              disabled={generating || sermon.status === "generating" || !sermon.audio_url}
              onClick={generateTranscript}
            >
              {generating || sermon.status === "generating" ? (
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
        </div>

        {/* Transcript Display */}
        {sermon.transcript && (
          <div className="border border-border/30 rounded-lg p-6 bg-card/50">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-mono text-sm uppercase tracking-widest">Transcript</h2>
              {sermon.transcript_generated_at && (
                <span className="text-xs font-mono text-muted-foreground">
                  Generated {format(new Date(sermon.transcript_generated_at), "MMM d, yyyy")}
                </span>
              )}
            </div>
            <div className="prose prose-invert max-w-none">
              <pre className="font-mono text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {sermon.transcript}
              </pre>
            </div>
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
