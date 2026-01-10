/**
 * Orchestrator for tiered transcript extraction
 * Implements the strategy: YouTube → Podbean → Apple Podcasts → fallback
 * 
 * Priority order:
 * 1. YouTube (auto-generated captions - most reliable)
 * 2. Podbean (episode page or RSS feed)
 * 3. Apple Podcasts (metadata only, usually no transcript)
 */

import { extractFromVTT } from "./extractFromVTT";
import { extractFromHTML } from "./extractFromHTML";
import { extractFromRSS } from "./extractFromRSS";
import { cleanTranscript } from "./cleanTranscript";
import {
  extractFromYouTube,
  extractFromYouTubePage,
  extractYouTubeVideoId,
} from "./extractFromYouTube";
import { extractFromYouTubeAPI } from "./extractFromYouTubeAPI";
import {
  extractFromPodbean,
  extractFromPodbeanRSS,
  isPodbeanUrl,
} from "./extractFromPodbean";

export interface TranscriptResult {
  success: boolean;
  title?: string;
  transcript: string;
  error?: string;
  source?: "youtube" | "podbean" | "apple" | "generated" | "unknown";
  videoId?: string;
  audioUrl?: string;
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
 * Detects the source type from URL
 */
function detectSourceType(url: string): "youtube" | "podbean" | "apple" | "unknown" {
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return "youtube";
  }
  if (isPodbeanUrl(url)) {
    return "podbean";
  }
  if (url.includes("podcasts.apple.com")) {
    return "apple";
  }
  return "unknown";
}

/**
 * Attempts to find and fetch transcript from various sources
 * Priority: YouTube → Podbean → Apple Podcasts → HTML fallback
 */
export async function fetchTranscript(episodeUrl: string): Promise<TranscriptResult> {
  if (!episodeUrl || typeof episodeUrl !== "string") {
    return {
      success: false,
      transcript: "",
      error: "Invalid URL provided",
      source: "unknown",
    };
  }

  const sourceType = detectSourceType(episodeUrl);

  try {
    // 🥇 PRIORITY 1: YouTube (most reliable - auto-generated captions)
    if (sourceType === "youtube" || extractYouTubeVideoId(episodeUrl)) {
      const videoId = extractYouTubeVideoId(episodeUrl);
      if (videoId) {
        console.log(`[fetchTranscript] Attempting YouTube transcript extraction for video: ${videoId}`);
        
        // Try YouTube Data API v3 FIRST if API key is available (most reliable, works for JS-loaded captions)
        const youtubeApiKey = process.env.YOUTUBE_API_KEY;
        if (youtubeApiKey && youtubeApiKey.trim().length > 0) {
          console.log(`[fetchTranscript] Trying YouTube Data API v3 (official API - most reliable)...`);
          try {
            const apiResult = await extractFromYouTubeAPI(videoId, youtubeApiKey);
            if (apiResult.success && apiResult.transcript.trim().length > 100) {
              const cleaned = cleanTranscript(apiResult.transcript);
              if (cleaned.trim().length > 100) {
                console.log(`[fetchTranscript] ✅ YouTube Data API v3 succeeded (${cleaned.length} chars)`);
                return {
                  success: true,
                  title: apiResult.title || "YouTube Video",
                  transcript: cleaned,
                  source: "youtube",
                  videoId: apiResult.videoId,
                };
              }
            }
          } catch (apiError) {
            const apiErrorMessage = apiError instanceof Error ? apiError.message : String(apiError);
            console.error(`[fetchTranscript] YouTube Data API v3 failed: ${apiErrorMessage}`);
            // Continue to fallback methods
          }
        } else {
          console.log(`[fetchTranscript] YouTube Data API v3 not configured (YOUTUBE_API_KEY missing), using fallback methods...`);
        }

        // Fallback 1: Try page-based extraction (works for some videos)
        console.log(`[fetchTranscript] Trying page-based extraction...`);
        const pageResult = await extractFromYouTubePage(episodeUrl);
        if (pageResult.success && pageResult.transcript.trim().length > 100) {
          const cleaned = cleanTranscript(pageResult.transcript);
          if (cleaned.trim().length > 100) {
            console.log(`[fetchTranscript] ✅ Page-based YouTube extraction succeeded (${cleaned.length} chars)`);
            return {
              success: true,
              title: pageResult.title || "YouTube Video",
              transcript: cleaned,
              source: "youtube",
              videoId: pageResult.videoId,
            };
          }
        }

        // Fallback 2: Try youtube-transcript library (may be blocked on Vercel)
        console.log(`[fetchTranscript] Trying youtube-transcript library...`);
        const youtubeResult = await extractFromYouTube(episodeUrl);
        if (youtubeResult.success && youtubeResult.transcript.trim().length > 100) {
          const cleaned = cleanTranscript(youtubeResult.transcript);
          if (cleaned.trim().length > 100) {
            console.log(`[fetchTranscript] ✅ youtube-transcript library succeeded (${cleaned.length} chars)`);
            return {
              success: true,
              title: youtubeResult.title || "YouTube Video",
              transcript: cleaned,
              source: "youtube",
              videoId: youtubeResult.videoId,
            };
          }
        }
        
        // If both methods failed, provide helpful error with direct link
        console.log(`[fetchTranscript] Both YouTube extraction methods failed for video ${videoId}`);
        const videoLink = `https://www.youtube.com/watch?v=${videoId}`;
        return {
          success: false,
          transcript: "",
          source: "youtube",
          videoId: videoId || undefined,
          error: `Unable to extract captions from this YouTube video.\n\nVideo ID: ${videoId}\nVideo Link: ${videoLink}\n\nPossible reasons:\n• Captions are loaded via JavaScript (not accessible to serverless functions)\n• YouTube is blocking automated requests\n• Captions may require authentication\n\nSolutions:\n1. Use YouTube Data API v3 (requires free API key - see YOUTUBE_CAPTION_LIMITATION.md)\n2. Use Whisper AI transcription fallback (free via Hugging Face)\n3. Manually verify captions are enabled on YouTube\n\nNote: Even if you can see captions when visiting YouTube manually, they may not be accessible to automated tools.`,
        };
      }
    }

    // 🥈 PRIORITY 2: Podbean (primary podcast host)
    if (sourceType === "podbean" || isPodbeanUrl(episodeUrl)) {
      console.log("Attempting Podbean transcript extraction...");
      
      // Try episode page first
      const podbeanResult = await extractFromPodbean(episodeUrl);
      if (podbeanResult.success && podbeanResult.transcript.trim().length > 100) {
        const cleaned = cleanTranscript(podbeanResult.transcript);
        if (cleaned.trim().length > 100) {
          return {
            success: true,
            title: podbeanResult.title || "Podbean Episode",
            transcript: cleaned,
            source: "podbean",
            audioUrl: podbeanResult.audioUrl,
          };
        }
      }

      // Try RSS feed if available (pass episodeUrl for better matching)
      if (podbeanResult.rssUrl) {
        console.log("[fetchTranscript] Trying Podbean RSS feed extraction...");
        const rssResult = await extractFromPodbeanRSS(podbeanResult.rssUrl, episodeUrl);
        if (rssResult.success && rssResult.transcript.trim().length > 100) {
          const cleaned = cleanTranscript(rssResult.transcript);
          if (cleaned.trim().length > 100) {
            console.log("[fetchTranscript] Podbean RSS transcript extracted successfully");
            return {
              success: true,
              title: rssResult.title || podbeanResult.title || "Podbean Episode",
              transcript: cleaned,
              source: "podbean",
              audioUrl: rssResult.audioUrl || podbeanResult.audioUrl,
            };
          }
        }
      }

      // Podbean transcript not found, but we have audio URL for future Whisper fallback
      if (podbeanResult.audioUrl) {
        return {
          success: false,
          transcript: "",
          title: podbeanResult.title,
          audioUrl: podbeanResult.audioUrl,
          source: "podbean",
          error:
            "Transcript not found on Podbean page. The transcript may need to be manually generated on Podbean, or you can try the YouTube version of this episode if available.",
        };
      }
    }

    // 🥉 PRIORITY 3: Apple Podcasts (metadata only, usually no transcript)
    // But we'll try anyway for completeness
    if (sourceType === "apple") {
      console.log("Attempting Apple Podcasts extraction (limited success expected)...");
      
      // Fetch the episode page
      const response = await fetchWithTimeout(episodeUrl);

      if (!response.ok) {
        return {
          success: false,
          transcript: "",
          error: `Failed to fetch episode page: ${response.status} ${response.statusText}`,
          source: "apple",
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
                source: "apple",
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
              source: "apple",
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
                    source: "apple",
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
          source: "apple",
        };
      }
    }

    // Step 6: If nothing worked, return helpful error
      return {
        success: false,
        transcript: "",
        title: htmlResult.title,
        source: "apple",
        error:
          "Unable to find a transcript for this Apple Podcasts episode. Apple Podcasts pages are metadata-only and typically don't contain transcripts.\n\n" +
          "💡 Try these instead:\n" +
          "• The Podbean episode URL (if available)\n" +
          "• The YouTube video URL (if the episode is on YouTube)\n" +
          "• The podcast's RSS feed URL",
      };
    }

    // If we reach here, source type was unknown or generic URL
    // Try generic HTML extraction as last resort
    try {
      const response = await fetchWithTimeout(episodeUrl);
      if (response.ok) {
        const html = await response.text();
        const htmlResult = extractFromHTML(html);

        if (htmlResult.success && htmlResult.transcript.length > 100) {
          const cleaned = cleanTranscript(htmlResult.transcript);
          if (cleaned.trim().length > 100) {
            return {
              success: true,
              title: htmlResult.title,
              transcript: cleaned,
              source: "unknown",
            };
          }
        }
      }
    } catch (fallbackError) {
      console.warn("Generic HTML extraction failed:", fallbackError);
    }

    // Final fallback: return helpful error
    return {
      success: false,
      transcript: "",
      source: sourceType,
      error:
        "Unable to extract transcript from this URL. Please try:\n\n" +
        "• YouTube video URL (most reliable - auto-generated captions)\n" +
        "• Podbean episode URL\n" +
        "• Direct transcript file link (.vtt, .srt)",
    };
  } catch (error) {
    console.error("Error fetching transcript:", error);

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return {
          success: false,
          transcript: "",
          source: sourceType,
          error: "Request timed out. The server may be slow or unreachable.",
        };
      }
    }

    return {
      success: false,
      transcript: "",
      source: sourceType,
      error: `Failed to fetch transcript: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
