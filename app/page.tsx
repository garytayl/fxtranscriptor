"use client";

import { useState } from "react";
import { Copy, Download, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [source, setSource] = useState<"youtube" | "podbean" | "apple" | "generated" | "unknown" | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      setError("Please enter a podcast episode URL");
      return;
    }

    setLoading(true);
    setError("");
    setTranscript("");
    setTitle("");
    setSource(null);
    setCopied(false);

    try {
      const response = await fetch("/api/transcript", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to fetch transcript");
        if (data.title) {
          setTitle(data.title);
        }
        return;
      }

      // Validate transcript has content
      const transcriptText = data.transcript?.trim() || "";
      if (!transcriptText || transcriptText.length < 50) {
        setError(
          data.error || "Transcript was returned but appears to be empty or invalid. The episode may not have a transcript available."
        );
        if (data.title) {
          setTitle(data.title);
        }
        return;
      }

      setTranscript(transcriptText);
      setTitle(data.title || "Untitled Episode");
      setSource(data.source || null);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAll = async () => {
    if (!transcript) return;

    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError("Failed to copy to clipboard. Please select and copy manually.");
    }
  };

  const handleDownload = () => {
    if (!transcript) return;

    const blob = new Blob([transcript], { type: "text/plain" });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `${title || "transcript"}.txt`.replace(/[^a-z0-9]/gi, "_");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  };

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 pt-8">
          <div className="mb-4">
            <h1 className="text-5xl md:text-7xl font-black mb-3 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80">
              FX Transcriptor
            </h1>
            <div className="w-24 h-1 bg-white mx-auto"></div>
          </div>
          <p className="text-lg text-white/60 font-light tracking-wide">
            Extract clean, copyable transcripts from YouTube, Podbean, and podcast sources
          </p>
        </div>

        {/* URL Input Form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste YouTube, Podbean, or podcast episode URL..."
              className="flex-1 px-6 py-4 rounded-none border-2 border-white/20 bg-black/50 text-white placeholder:text-white/30 font-mono text-sm focus:outline-none focus:border-white focus:bg-black/80 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-8 py-4 border-2 border-white bg-transparent text-white font-bold uppercase tracking-wider text-sm hover:bg-white hover:text-black transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-white flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing</span>
                </>
              ) : (
                <>
                  <span>Extract</span>
                  <span className="hidden sm:inline">Transcript</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-6 border-2 border-white/20 bg-black/50 backdrop-blur-sm">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-white" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold mb-2 uppercase tracking-wide text-sm">
                  {title ? `Error: "${title}"` : "Error"}
                </h3>
                <p className="text-white/70 text-sm leading-relaxed whitespace-pre-line font-mono">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Title Display */}
        {title && !error && (
          <div className="mb-6 p-6 border-2 border-white/20 bg-black/50 backdrop-blur-sm">
            <div className="flex items-start gap-4 mb-4">
              <CheckCircle2 className="w-6 h-6 text-white flex-shrink-0 mt-0.5" strokeWidth={2} />
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white mb-2 leading-tight">
                  {title}
                </h2>
                {source && (
                  <div className="text-xs text-white/50 uppercase tracking-widest font-mono mt-3 pt-3 border-t border-white/10">
                    <span className="text-white/70">Source: </span>
                    <span className="font-bold">
                      {source === "youtube" && "YOUTUBE"}
                      {source === "podbean" && "PODBEAN"}
                      {source === "apple" && "APPLE PODCASTS"}
                      {source === "generated" && "AUTO-GENERATED"}
                      {source === "unknown" && "UNKNOWN"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Transcript Display */}
        {transcript && (
          <div className="space-y-4">
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleCopyAll}
                className="px-6 py-3 border-2 border-white bg-transparent text-white font-bold uppercase tracking-wider text-xs hover:bg-white hover:text-black transition-all duration-200 flex items-center gap-3 group"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 group-hover:scale-110 transition-transform" strokeWidth={2.5} />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 group-hover:scale-110 transition-transform" strokeWidth={2.5} />
                    <span>Copy All</span>
                  </>
                )}
              </button>
              <button
                onClick={handleDownload}
                className="px-6 py-3 border-2 border-white bg-transparent text-white font-bold uppercase tracking-wider text-xs hover:bg-white hover:text-black transition-all duration-200 flex items-center gap-3 group"
              >
                <Download className="w-4 h-4 group-hover:scale-110 transition-transform" strokeWidth={2.5} />
                <span>Download .txt</span>
              </button>
            </div>

            {/* Transcript Textarea */}
            <div className="relative border-2 border-white/20 bg-black/50 backdrop-blur-sm">
              <textarea
                readOnly
                value={transcript}
                className="w-full h-[600px] p-8 bg-black/30 text-white font-mono text-sm leading-relaxed resize-none focus:outline-none border-0 focus:ring-0 selection:bg-white selection:text-black"
                onClick={(e) => {
                  // Select all text on click for easy copying
                  e.currentTarget.select();
                }}
              />
              <div className="absolute top-0 right-0 p-2 border-l-2 border-b-2 border-white/20 bg-black/80">
                <span className="text-xs text-white/50 uppercase tracking-widest font-mono">
                  {transcript.length.toLocaleString()} chars
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Footer/Info */}
        {!transcript && !loading && !error && (
          <div className="mt-16 p-8 border-2 border-white/10 bg-black/30 backdrop-blur-sm">
            <div className="text-center space-y-6">
              <div>
                <h3 className="text-white font-bold uppercase tracking-widest text-sm mb-4">
                  How to Use
                </h3>
                <div className="space-y-4 text-white/60 text-sm leading-relaxed max-w-2xl mx-auto">
                  <p className="text-white/80 font-medium">
                    For best results, use one of these sources:
                  </p>
                  <div className="grid md:grid-cols-3 gap-4 mt-6 text-left">
                    <div className="p-4 border border-white/10 bg-black/50">
                      <div className="text-white font-bold text-xs uppercase tracking-widest mb-2">YouTube</div>
                      <p className="text-white/50 text-xs leading-relaxed">Auto-generated captions - most reliable</p>
                    </div>
                    <div className="p-4 border border-white/10 bg-black/50">
                      <div className="text-white font-bold text-xs uppercase tracking-widest mb-2">Podbean</div>
                      <p className="text-white/50 text-xs leading-relaxed">Primary podcast host</p>
                    </div>
                    <div className="p-4 border border-white/10 bg-black/50">
                      <div className="text-white font-bold text-xs uppercase tracking-widest mb-2">Other</div>
                      <p className="text-white/50 text-xs leading-relaxed">RSS feeds, direct links</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-white/10 text-center">
          <p className="text-white/30 text-xs uppercase tracking-widest font-mono">
            FX Transcriptor • Multi-Source Transcript Aggregator
          </p>
        </div>
      </div>
    </main>
  );
}
