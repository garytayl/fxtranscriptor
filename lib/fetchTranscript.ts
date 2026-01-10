/**
 * Orchestrator for tiered transcript extraction
 * Implements the strategy: VTT/JSON → RSS → HTML → fallback
 */

import { extractFromVTT } from "./extractFromVTT";
import { extractFromHTML } from "./extractFromHTML";
import { extractFromRSS } from "./extractFromRSS";
import { cleanTranscript } from "./cleanTranscript";

export interface TranscriptResult {
  success: boolean;
  title?: string;
  transcript: string;
  error?: string;
}

const FETCH_TIMEOUT = 15000; // 15 seconds
const USER_AGENT = "Mozilla/5.0 (compatible; TranscriptBot/1.0; +https://github.com)";

/**
 * Fetches a web resource with timeout and proper headers
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml,text/vtt,application/json",
        ...options.headers,
      },
    });

    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

/**
 * Attempts to find and fetch transcript from various sources
 */
export async function fetchTranscript(episodeUrl: string): Promise<TranscriptResult> {
  if (!episodeUrl || typeof episodeUrl !== "string") {
    return {
      success: false,
      transcript: "",
      error: "Invalid URL provided",
    };
  }

  try {
    // Step 1: Fetch the episode page
    const response = await fetchWithTimeout(episodeUrl);

    if (!response.ok) {
      return {
        success: false,
        transcript: "",
        error: `Failed to fetch episode page: ${response.status} ${response.statusText}`,
      };
    }

    const html = await response.text();
    const htmlResult = extractFromHTML(html);

    // Step 2: Look for transcript file references in the HTML
    const transcriptLinkPatterns = [
      /href=["']([^"']*\.vtt[^"']*)["']/gi,
      /src=["']([^"']*\.vtt[^"']*)["']/gi,
      /url["']?\s*:\s*["']([^"']*\.vtt[^"']*)["']/gi,
      /transcript["']?\s*:\s*["']([^"']*)["']/gi,
    ];

    let transcriptUrl: string | null = null;

    for (const pattern of transcriptLinkPatterns) {
      const matches = Array.from(html.matchAll(pattern));
      for (const match of matches) {
        if (match[1]) {
          const url = new URL(match[1], episodeUrl).href;
          // Verify it's likely a transcript URL
          if (url.includes(".vtt") || url.includes("transcript")) {
            transcriptUrl = url;
            break;
          }
        }
      }
      if (transcriptUrl) break;
    }

    // Step 3: If found, try to fetch VTT file
    if (transcriptUrl) {
      try {
        const vttResponse = await fetchWithTimeout(transcriptUrl, {
          headers: {
            Accept: "text/vtt,text/plain,*/*",
          },
        });

        if (vttResponse.ok) {
          const vttContent = await vttResponse.text();
          const vttResult = extractFromVTT(vttContent);

          if (vttResult.success && vttResult.transcript.length > 50) {
            const cleaned = cleanTranscript(vttResult.transcript);
            return {
              success: true,
              title: htmlResult.title,
              transcript: cleaned,
            };
          }
        }
      } catch (error) {
        console.warn("Failed to fetch VTT file, falling back:", error);
      }
    }

    // Step 4: Try RSS feed extraction
    // Extract RSS feed URL from Apple Podcasts page
    const rssPattern = /<link[^>]*rel="alternate"[^>]*type="application\/rss\+xml"[^>]*href="([^"]+)"/i;
    const rssMatch = html.match(rssPattern);
    if (rssMatch && rssMatch[1]) {
      const rssUrl = new URL(rssMatch[1], episodeUrl).href;
      const rssResult = await extractFromRSS(rssUrl);

      if (rssResult.success) {
        if (rssResult.transcript) {
          const cleaned = cleanTranscript(rssResult.transcript);
          return {
            success: true,
            title: htmlResult.title,
            transcript: cleaned,
          };
        }

        // If RSS returned a transcript URL, fetch it
        if (rssResult.transcriptUrl) {
          try {
            const transcriptResponse = await fetchWithTimeout(rssResult.transcriptUrl);
            if (transcriptResponse.ok) {
              const transcriptContent = await transcriptResponse.text();
              const vttResult = extractFromVTT(transcriptContent);
              if (vttResult.success) {
                const cleaned = cleanTranscript(vttResult.transcript);
                return {
                  success: true,
                  title: htmlResult.title,
                  transcript: cleaned,
                };
              }
            }
          } catch (error) {
            console.warn("Failed to fetch transcript from RSS URL:", error);
          }
        }
      }
    }

    // Step 5: Fallback to HTML extraction
    if (htmlResult.success && htmlResult.transcript.length > 50) {
      const cleaned = cleanTranscript(htmlResult.transcript);
      return {
        success: true,
        title: htmlResult.title,
        transcript: cleaned,
      };
    }

    // Step 6: If nothing worked, return helpful error
    return {
      success: false,
      transcript: "",
      title: htmlResult.title,
      error:
        "Transcript not publicly accessible from this URL. The episode may not have a transcript available, or it may be behind authentication. Try pasting the podcast RSS feed or hosting provider link instead.",
    };
  } catch (error) {
    console.error("Error fetching transcript:", error);

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return {
          success: false,
          transcript: "",
          error: "Request timed out. The server may be slow or unreachable.",
        };
      }
    }

    return {
      success: false,
      transcript: "",
      error: `Failed to fetch transcript: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
