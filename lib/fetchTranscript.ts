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

    // Step 2: Look for JSON-LD structured data that might contain transcript links
    const jsonLdPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis;
    const jsonLdMatches = Array.from(html.matchAll(jsonLdPattern));
    
    let transcriptUrl: string | null = null;

    // Parse JSON-LD for transcript links
    for (const match of jsonLdMatches) {
      try {
        const jsonData = JSON.parse(match[1]);
        const searchInObject = (obj: any): string | null => {
          if (!obj || typeof obj !== "object") return null;
          
          // Check for transcript URLs in various formats
          if (obj.transcript && typeof obj.transcript === "string") {
            return obj.transcript;
          }
          if (obj["@type"] === "PodcastEpisode" && obj.transcript) {
            return typeof obj.transcript === "string" ? obj.transcript : obj.transcript.url;
          }
          
          // Recursively search nested objects
          for (const key in obj) {
            if (key.toLowerCase().includes("transcript")) {
              const value = obj[key];
              if (typeof value === "string" && (value.includes(".vtt") || value.includes("transcript"))) {
                return value;
              }
              if (typeof value === "object" && value.url) {
                return value.url;
              }
            }
            if (typeof obj[key] === "object") {
              const found = searchInObject(obj[key]);
              if (found) return found;
            }
          }
          return null;
        };
        
        const foundUrl = searchInObject(jsonData);
        if (foundUrl) {
          transcriptUrl = new URL(foundUrl, episodeUrl).href;
          break;
        }
      } catch (e) {
        // Invalid JSON, skip
        continue;
      }
    }

    // Step 2b: Look for transcript file references in the HTML (fallback)
    if (!transcriptUrl) {
      const transcriptLinkPatterns = [
        /href=["']([^"']*\.vtt[^"']*)["']/gi,
        /src=["']([^"']*\.vtt[^"']*)["']/gi,
        /url["']?\s*:\s*["']([^"']*\.vtt[^"']*)["']/gi,
        /transcript["']?\s*:\s*["']([^"']*)["']/gi,
        /data-transcript-url=["']([^"']*)["']/gi,
      ];

      for (const pattern of transcriptLinkPatterns) {
        const matches = Array.from(html.matchAll(pattern));
        for (const match of matches) {
          if (match[1]) {
            const url = new URL(match[1], episodeUrl).href;
            // Verify it's likely a transcript URL
            if (url.includes(".vtt") || url.includes("transcript") || url.includes("subtitle")) {
              transcriptUrl = url;
              break;
            }
          }
        }
        if (transcriptUrl) break;
      }
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

          if (vttResult.success && vttResult.transcript.length > 100) {
            const cleaned = cleanTranscript(vttResult.transcript);
            // Validate cleaned transcript has meaningful content
            if (cleaned.trim().length > 100) {
              return {
                success: true,
                title: htmlResult.title,
                transcript: cleaned,
              };
            }
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
        if (rssResult.transcript && rssResult.transcript.trim().length > 100) {
          const cleaned = cleanTranscript(rssResult.transcript);
          // Validate cleaned transcript has meaningful content
          if (cleaned.trim().length > 100) {
            return {
              success: true,
              title: htmlResult.title,
              transcript: cleaned,
            };
          }
        }

        // If RSS returned a transcript URL, fetch it
        if (rssResult.transcriptUrl) {
          try {
            const transcriptResponse = await fetchWithTimeout(rssResult.transcriptUrl);
            if (transcriptResponse.ok) {
              const transcriptContent = await transcriptResponse.text();
              const vttResult = extractFromVTT(transcriptContent);
              if (vttResult.success && vttResult.transcript.length > 100) {
                const cleaned = cleanTranscript(vttResult.transcript);
                // Validate cleaned transcript
                if (cleaned.trim().length > 100) {
                  return {
                    success: true,
                    title: htmlResult.title,
                    transcript: cleaned,
                  };
                }
              }
            }
          } catch (error) {
            console.warn("Failed to fetch transcript from RSS URL:", error);
          }
        }
      }
    }

    // Step 5: Fallback to HTML extraction
    if (htmlResult.success && htmlResult.transcript.length > 100) {
      const cleaned = cleanTranscript(htmlResult.transcript);
      // Validate cleaned transcript has meaningful content
      if (cleaned.trim().length > 100) {
        return {
          success: true,
          title: htmlResult.title,
          transcript: cleaned,
        };
      }
    }

    // Step 6: If nothing worked, return helpful error
    return {
      success: false,
      transcript: "",
      title: htmlResult.title,
      error:
        "Unable to find a transcript for this episode. Apple Podcasts pages typically don't include transcripts—they only show metadata. To get transcripts, you'll need to:\n\n" +
        "1. Find the podcast's RSS feed URL\n" +
        "2. Check if transcripts are available in the RSS feed metadata\n" +
        "3. Or contact the podcast host directly\n\n" +
        "If this podcast episode should have a transcript, try pasting the podcast RSS feed URL or the hosting provider's episode page URL instead.",
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
