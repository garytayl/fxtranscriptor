/**
 * Extracts transcripts from YouTube videos
 * Uses the free 'youtube-transcript' npm package for reliable extraction
 * YouTube auto-generates captions for most videos, making this a reliable source
 */

// @ts-ignore - youtube-transcript doesn't have TypeScript types
import { YoutubeTranscript } from 'youtube-transcript';

export interface YouTubeExtractResult {
  success: boolean;
  transcript: string;
  title?: string;
  videoId?: string;
}

/**
 * Extracts YouTube video ID from various URL formats
 */
export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Fetches YouTube transcript using the free 'youtube-transcript' package
 * This is the most reliable method and works well on Vercel/serverless
 */
export async function extractFromYouTube(
  videoUrl: string
): Promise<YouTubeExtractResult> {
  const videoId = extractYouTubeVideoId(videoUrl);

  if (!videoId) {
    return { success: false, transcript: "" };
  }

  try {
    console.log(`[YouTube] Fetching transcript for video ID: ${videoId}`);
    
    // Use the youtube-transcript library (free, reliable)
    // Try to get available languages first, then fetch transcript
    let transcriptItems: any[] = [];
    
    try {
      // Try English first (most common)
      transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: 'en',
      });
      console.log(`[YouTube] Successfully fetched English transcript (${transcriptItems.length} items)`);
    } catch (enError) {
      const enErrorMessage = enError instanceof Error ? enError.message : String(enError);
      console.log(`[YouTube] English transcript failed: ${enErrorMessage}`);
      console.log(`[YouTube] Trying without language specification...`);
      
      try {
        // Try without language specification (gets any available captions)
        transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
        console.log(`[YouTube] Successfully fetched transcript in any language (${transcriptItems.length} items)`);
      } catch (anyLangError) {
        const anyLangErrorMessage = anyLangError instanceof Error ? anyLangError.message : String(anyLangError);
        console.error(`[YouTube] Any language transcript also failed: ${anyLangErrorMessage}`);
        // If that fails, try to get list of available languages
        console.log(`[YouTube] Attempting to list available languages...`);
        try {
          // @ts-ignore - listFormats is available but not in types
          const formats = await YoutubeTranscript.listFormats?.(videoId).catch(() => null);
          if (formats) {
            console.log(`[YouTube] Available languages: ${formats.map((f: any) => f.languageCode).join(', ')}`);
          }
        } catch (listError) {
          // Ignore list error
        }
        
        // Check if error indicates no captions available
        const errorMessage = (anyLangError instanceof Error ? anyLangError.message : String(anyLangError)).toLowerCase();
        if (errorMessage.includes('could not retrieve') || 
            errorMessage.includes('no transcript') ||
            errorMessage.includes('not available') ||
            errorMessage.includes('disabled')) {
          console.log(`[YouTube] No captions available for video ${videoId}`);
          return { 
            success: false, 
            transcript: "", 
            videoId,
          };
        }
        
        // Re-throw if it's a different error
        throw anyLangError;
      }
    }

    if (transcriptItems && transcriptItems.length > 0) {
      // Combine all transcript items into a single text
      // Type: transcriptItems is an array of { text: string, offset: number, duration: number }
      let fullTranscript = transcriptItems
        .map((item: any) => item.text)
        .join(' ');

      // Format into readable paragraphs (group sentences)
      const sentences = fullTranscript
        .replace(/\. +/g, ".\n")
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const paragraphs: string[] = [];
      let currentParagraph = "";

      for (const sentence of sentences) {
        if (currentParagraph.length + sentence.length > 500) {
          if (currentParagraph) paragraphs.push(currentParagraph.trim());
          currentParagraph = sentence;
        } else {
          currentParagraph += (currentParagraph ? " " : "") + sentence;
        }
      }

      if (currentParagraph) {
        paragraphs.push(currentParagraph.trim());
      }

      const transcript = paragraphs.join("\n\n");

      if (transcript.trim().length > 100) {
        console.log(`[YouTube] Successfully extracted transcript (${transcript.length} chars)`);
        return {
          success: true,
          transcript,
          videoId,
        };
      } else {
        console.log(`[YouTube] Transcript too short (${transcript.length} chars), likely incomplete`);
      }
    }

    console.log(`[YouTube] No transcript found for video ID: ${videoId} (no items returned)`);
    return { success: false, transcript: "", videoId };
  } catch (error) {
    console.error(`[YouTube] Error extracting transcript for ${videoId}:`, error);
    
    // Provide helpful error messages
    const errorMessage = error instanceof Error ? error.message : String(error);
    const lowerError = errorMessage.toLowerCase();
    
    if (lowerError.includes('could not retrieve') || 
        lowerError.includes('no transcript') ||
        lowerError.includes('not available') ||
        lowerError.includes('disabled') ||
        lowerError.includes('does not exist')) {
      console.log(`[YouTube] Video ${videoId} has no captions available`);
      return { 
        success: false, 
        transcript: "", 
        videoId,
      };
    }
    
    // For other errors, log and return failure
    console.error(`[YouTube] Unexpected error for ${videoId}:`, errorMessage);
    return { success: false, transcript: "", videoId };
  }
}

/**
 * Alternative method: Fetch transcript from YouTube video page
 * This method parses the video page HTML to find caption tracks
 */
export async function extractFromYouTubePage(
  videoUrl: string
): Promise<YouTubeExtractResult> {
  const videoId = extractYouTubeVideoId(videoUrl);

  if (!videoId) {
    return { success: false, transcript: "" };
  }

  try {
    // Fetch the YouTube video page
    const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(videoPageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "text/html",
      },
    });

    if (!response.ok) {
      return { success: false, transcript: "", videoId };
    }

    const html = await response.text();

    // Extract video title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch
      ? titleMatch[1].replace(/\s*-\s*YouTube$/, "").trim()
      : undefined;

    console.log(`[YouTube Page] Searching for caption tracks in page HTML (${html.length} chars)...`);

    // Look for caption track URLs in multiple places (YouTube may embed data differently)
    let captionTracks: any[] = [];
    
    // Method 1: Look in ytInitialPlayerResponse (most common)
    // YouTube might embed this in a script tag or inline
    let playerResponseMatch = html.match(
      /var ytInitialPlayerResponse = ({.*?});/s
    );
    
    // Also try with more flexible matching (YouTube sometimes uses single quotes, etc.)
    if (!playerResponseMatch) {
      playerResponseMatch = html.match(
        /ytInitialPlayerResponse\s*=\s*({.*?});/s
      );
    }
    
    // Also check for window["ytInitialPlayerResponse"]
    if (!playerResponseMatch) {
      playerResponseMatch = html.match(
        /window\["ytInitialPlayerResponse"\]\s*=\s*({.*?});/s
      );
    }
    
    // Also check for embedded in JSON-LD or script tag
    if (!playerResponseMatch) {
      const scriptTags = html.matchAll(/<script[^>]*>(.*?)<\/script>/gs);
      for (const match of scriptTags) {
        const scriptContent = match[1];
        if (scriptContent.includes('ytInitialPlayerResponse')) {
          const innerMatch = scriptContent.match(/ytInitialPlayerResponse\s*[=:]\s*({.*?});/s);
          if (innerMatch) {
            playerResponseMatch = innerMatch;
            break;
          }
        }
      }
    }

    if (playerResponseMatch) {
      try {
        console.log(`[YouTube Page] Found ytInitialPlayerResponse, parsing...`);
        const playerResponse = JSON.parse(playerResponseMatch[1]);
        
        // Debug: Check if captions object exists
        console.log(`[YouTube Page] Player response has captions:`, !!playerResponse?.captions);
        console.log(`[YouTube Page] Captions structure:`, playerResponse?.captions ? Object.keys(playerResponse.captions) : 'none');
        
        // Find caption tracks in multiple possible locations
        captionTracks = 
          playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ||
          playerResponse?.captions?.playerCaptionsRenderer?.captionTracks ||
          playerResponse?.captionTracks ||
          [];
        
        // Also check in different nested structures
        if (captionTracks.length === 0) {
          // Check if captions is an object with a different structure
          if (playerResponse?.captions) {
            const captionsObj = playerResponse.captions;
            // Try to find captionTracks anywhere in the captions object
            const searchForCaptionTracks = (obj: any, depth = 0): any[] => {
              if (depth > 3) return []; // Limit recursion depth
              if (Array.isArray(obj)) {
                for (const item of obj) {
                  if (item?.baseUrl && (item?.languageCode || item?.lang)) {
                    return [item];
                  }
                  const found = searchForCaptionTracks(item, depth + 1);
                  if (found.length > 0) return found;
                }
              } else if (obj && typeof obj === 'object') {
                // Check if this object has baseUrl and looks like a caption track
                if (obj.baseUrl && (obj.languageCode || obj.lang)) {
                  return [obj];
                }
                // Recursively search all properties
                for (const key in obj) {
                  if (key === 'captionTracks' && Array.isArray(obj[key])) {
                    return obj[key];
                  }
                  const found = searchForCaptionTracks(obj[key], depth + 1);
                  if (found.length > 0) return found;
                }
              }
              return [];
            };
            
            const foundTracks = searchForCaptionTracks(captionsObj);
            if (foundTracks.length > 0) {
              captionTracks = foundTracks;
              console.log(`[YouTube Page] Found ${captionTracks.length} caption tracks via recursive search`);
            }
          }
        }
        
        console.log(`[YouTube Page] Found ${captionTracks.length} caption tracks in ytInitialPlayerResponse`);
        if (captionTracks.length > 0) {
          console.log(`[YouTube Page] Caption track languages:`, captionTracks.map((t: any) => t.languageCode || t.lang || 'unknown').join(', '));
        }
      } catch (e) {
        console.error(`[YouTube Page] Error parsing ytInitialPlayerResponse:`, e);
      }
    }

    // Method 2: Look in ytInitialData (fallback)
    if (captionTracks.length === 0) {
      const ytInitialDataMatch = html.match(
        /var ytInitialData = ({.*?});/s
      );
      
      if (ytInitialDataMatch) {
        try {
          console.log(`[YouTube Page] Trying ytInitialData...`);
          const initialData = JSON.parse(ytInitialDataMatch[1]);
          
          // Navigate through YouTube's nested structure
          const videoDetails = initialData?.contents?.twoColumnWatchNextResults?.results?.results?.contents || [];
          for (const item of videoDetails) {
            if (item?.videoSecondaryInfoRenderer?.metadataRowContainer?.metadataRowContainerRenderer?.rows) {
              // Check metadata rows for captions
            }
          }
          
          // Try to find in player response within initial data
          captionTracks = 
            initialData?.playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ||
            [];
          
          console.log(`[YouTube Page] Found ${captionTracks.length} caption tracks in ytInitialData`);
        } catch (e) {
          console.error(`[YouTube Page] Error parsing ytInitialData:`, e);
        }
      }
    }

    // Method 3: Direct search for caption URLs in HTML
    if (captionTracks.length === 0) {
      console.log(`[YouTube Page] Searching for caption URLs directly in HTML...`);
      const captionUrlPattern = /"captionTracks":\s*\[(.*?)\]/s;
      const captionMatch = html.match(captionUrlPattern);
      if (captionMatch) {
        try {
          const captionJson = JSON.parse(`[${captionMatch[1]}]`);
          captionTracks = captionJson.filter((track: any) => track.baseUrl);
          console.log(`[YouTube Page] Found ${captionTracks.length} caption tracks via direct search`);
        } catch (e) {
          console.error(`[YouTube Page] Error parsing caption tracks from HTML:`, e);
        }
      }
    }

    if (captionTracks.length > 0) {
      console.log(`[YouTube Page] Processing ${captionTracks.length} caption tracks...`);
      
      // Prefer English, fallback to first available
      let captionTrack = captionTracks.find(
        (track: any) => track.languageCode === "en" || track.languageCode === "en-US"
      );
      if (!captionTrack) {
        captionTrack = captionTracks.find((track: any) => track.languageCode?.startsWith("en"));
      }
      if (!captionTrack) {
        captionTrack = captionTracks[0];
      }

      if (captionTrack?.baseUrl) {
        console.log(`[YouTube Page] Fetching transcript from: ${captionTrack.baseUrl.substring(0, 100)}...`);
        
        // Fetch the transcript XML
        const transcriptResponse = await fetch(captionTrack.baseUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; TranscriptBot/1.0)",
            "Accept": "text/xml,application/xml,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8",
          },
        });

        if (transcriptResponse.ok) {
          const xml = await transcriptResponse.text();
          console.log(`[YouTube Page] Successfully fetched transcript XML (${xml.length} chars)`);

          // Parse XML transcript - handle multiple formats
          let textContent = xml
            // Handle <text> tags with start time
            .replace(/<text[^>]*start="[^"]*"[^>]*dur="[^"]*"[^>]*>([^<]*)<\/text>/gi, "$1 ")
            // Handle <text> tags without attributes
            .replace(/<text[^>]*>([^<]*)<\/text>/gi, "$1 ")
            // Remove all remaining XML tags
            .replace(/<[^>]*>/g, "")
            // Decode HTML entities
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&#39;/g, "'")
            .replace(/&apos;/g, "'")
            .replace(/&#8217;/g, "'")
            .replace(/&#8220;/g, '"')
            .replace(/&#8221;/g, '"')
            .replace(/&#8211;/g, "-")
            .replace(/&#8212;/g, "--")
            // Normalize whitespace
            .replace(/\s+/g, " ")
            .trim();

          if (textContent.length > 100) {
            console.log(`[YouTube Page] Successfully parsed transcript (${textContent.length} chars), formatting...`);
            
            // Format into readable paragraphs
            const sentences = textContent
              .replace(/\. +/g, ".\n")
              .split("\n")
              .map((s) => s.trim())
              .filter((s) => s.length > 0);

            const paragraphs: string[] = [];
            let currentParagraph = "";

            for (const sentence of sentences) {
              if (currentParagraph.length + sentence.length > 500) {
                if (currentParagraph)
                  paragraphs.push(currentParagraph.trim());
                currentParagraph = sentence;
              } else {
                currentParagraph +=
                  (currentParagraph ? " " : "") + sentence;
              }
            }

            if (currentParagraph) {
              paragraphs.push(currentParagraph.trim());
            }

            const transcript = paragraphs.join("\n\n");

            if (transcript.trim().length > 100) {
              console.log(`[YouTube Page] Successfully extracted transcript (${transcript.length} chars)`);
              return {
                success: true,
                transcript,
                title,
                videoId,
              };
            } else {
              console.log(`[YouTube Page] Transcript too short after formatting (${transcript.length} chars)`);
            }
          } else {
            console.log(`[YouTube Page] Transcript text content too short (${textContent.length} chars)`);
          }
        } else {
          console.error(`[YouTube Page] Failed to fetch transcript XML: ${transcriptResponse.status} ${transcriptResponse.statusText}`);
        }
      } else {
        console.error(`[YouTube Page] Caption track has no baseUrl`);
      }
    } else {
      console.log(`[YouTube Page] No caption tracks found in page HTML`);
    }

    return { success: false, transcript: "", title, videoId };
  } catch (error) {
    console.error("Error extracting YouTube transcript from page:", error);
    return { success: false, transcript: "", videoId };
  }
}
