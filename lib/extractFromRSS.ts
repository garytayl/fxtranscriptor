/**
 * Attempts to extract transcript from RSS feed metadata
 * Looks for transcript links or embedded transcript content
 */

export interface RSSExtractResult {
  success: boolean;
  transcript: string;
  transcriptUrl?: string;
}

export async function extractFromRSS(
  rssUrl: string,
  episodeId?: string
): Promise<RSSExtractResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(rssUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TranscriptBot/1.0)",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { success: false, transcript: "" };
    }

    const xml = await response.text();

    // Look for transcript links in RSS/XML
    const transcriptLinkPatterns = [
      /<itunes:transcript[^>]*url="([^"]+)"/i,
      /<transcript[^>]*url="([^"]+)"/i,
      /<link[^>]*rel="transcript"[^>]*href="([^"]+)"/i,
      /<enclosure[^>]*type="text\/vtt"[^>]*url="([^"]+)"/i,
      /<enclosure[^>]*type="application\/x-subrip"[^>]*url="([^"]+)"/i,
    ];

    for (const pattern of transcriptLinkPatterns) {
      const match = xml.match(pattern);
      if (match && match[1]) {
        const transcriptUrl = new URL(match[1], rssUrl).href;
        return { success: true, transcript: "", transcriptUrl };
      }
    }

    // Look for embedded transcript content
    const embeddedTranscriptPattern = /<itunes:transcript[^>]*>([\s\S]*?)<\/itunes:transcript>/i;
    const embeddedMatch = xml.match(embeddedTranscriptPattern);
    if (embeddedMatch && embeddedMatch[1]) {
      return {
        success: true,
        transcript: embeddedMatch[1].trim(),
      };
    }

    return { success: false, transcript: "" };
  } catch (error) {
    console.error("Error extracting from RSS:", error);
    return { success: false, transcript: "" };
  }
}
