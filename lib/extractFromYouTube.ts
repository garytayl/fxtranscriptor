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
    // It automatically handles:
    // - Finding available caption tracks
    // - Language selection (prefers English, falls back to others)
    // - Parsing and formatting
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: 'en', // Prefer English, but will fallback to available languages
    });

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
      }
    }

    console.log(`[YouTube] No transcript found for video ID: ${videoId}`);
    return { success: false, transcript: "", videoId };
  } catch (error) {
    console.error(`[YouTube] Error extracting transcript for ${videoId}:`, error);
    
    // Provide helpful error messages
    if (error instanceof Error) {
      if (error.message.includes('could not retrieve a transcript')) {
        return { 
          success: false, 
          transcript: "", 
          videoId,
        };
      }
    }
    
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

    // Look for caption track URLs in the page JSON
    // YouTube embeds data in ytInitialPlayerResponse
    const playerResponseMatch = html.match(
      /var ytInitialPlayerResponse = ({.*?});/s
    );

    if (playerResponseMatch) {
      try {
        const playerResponse = JSON.parse(playerResponseMatch[1]);
        
        // Find caption tracks
        const captionTracks =
          playerResponse?.captions?.playerCaptionsTracklistRenderer
            ?.captionTracks || [];

        if (captionTracks.length > 0) {
          // Prefer English, fallback to first available
          let captionTrack = captionTracks.find(
            (track: any) => track.languageCode === "en"
          );
          if (!captionTrack) {
            captionTrack = captionTracks[0];
          }

          if (captionTrack?.baseUrl) {
            // Fetch the transcript XML
            const transcriptResponse = await fetch(captionTrack.baseUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (compatible; TranscriptBot/1.0)",
              },
            });

            if (transcriptResponse.ok) {
              const xml = await transcriptResponse.text();

              // Parse XML transcript
              const textContent = xml
                .replace(/<text[^>]*start="([^"]*)"[^>]*>([^<]*)<\/text>/gi, "$2 ")
                .replace(/<[^>]*>/g, "")
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&#39;/g, "'")
                .replace(/&apos;/g, "'")
                .replace(/\s+/g, " ")
                .trim();

              if (textContent.length > 100) {
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

                return {
                  success: true,
                  transcript,
                  title,
                  videoId,
                };
              }
            }
          }
        }
      } catch (e) {
        console.error("Error parsing YouTube player response:", e);
      }
    }

    return { success: false, transcript: "", title, videoId };
  } catch (error) {
    console.error("Error extracting YouTube transcript from page:", error);
    return { success: false, transcript: "", videoId };
  }
}
