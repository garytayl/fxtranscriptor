/**
 * Extracts transcripts and metadata from Podbean episodes
 * Podbean hosts the primary podcast content
 */

export interface PodbeanExtractResult {
  success: boolean;
  transcript: string;
  title?: string;
  audioUrl?: string;
  rssUrl?: string;
}

/**
 * Detects if a URL is a Podbean URL
 */
export function isPodbeanUrl(url: string): boolean {
  return url.includes("podbean.com") || url.includes("podbean.io");
}

/**
 * Extracts transcript and metadata from Podbean episode page
 */
export async function extractFromPodbean(
  episodeUrl: string
): Promise<PodbeanExtractResult> {
  if (!isPodbeanUrl(episodeUrl)) {
    return { success: false, transcript: "" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(episodeUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { success: false, transcript: "" };
    }

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch
      ? titleMatch[1].replace(/\s*-\s*Podbean$/i, "").trim()
      : undefined;

    // Look for transcript in Podbean's page structure
    // Podbean may embed transcripts in various ways
    const transcriptPatterns = [
      // Podbean specific transcript containers
      /<div[^>]*class="[^"]*transcript[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<section[^>]*class="[^"]*transcript[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
      /<article[^>]*data-transcript[^>]*>([\s\S]*?)<\/article>/i,
      // JSON-LD structured data
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i,
    ];

    let transcriptContent = "";

    for (const pattern of transcriptPatterns) {
      const matches = Array.from(html.matchAll(pattern));
      for (const match of matches) {
        if (match[1]) {
          try {
            // Try parsing as JSON-LD first
            const jsonData = JSON.parse(match[1]);
            if (jsonData.transcript || jsonData.description) {
              transcriptContent = jsonData.transcript || jsonData.description;
              break;
            }
          } catch {
            // Not JSON, treat as HTML
            transcriptContent = match[1];
            break;
          }
        }
      }
      if (transcriptContent) break;
    }

    // Extract audio URL for potential Whisper fallback
    const audioPatterns = [
      /<audio[^>]*src="([^"]+\.mp3[^"]*)"[^>]*>/i,
      /data-audio-url="([^"]+)"/i,
      /"audioUrl":"([^"]+)"/i,
      /"enclosure":\s*{\s*"url":\s*"([^"]+)"/i,
    ];

    let audioUrl: string | undefined;

    for (const pattern of audioPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        audioUrl = new URL(match[1], episodeUrl).href;
        break;
      }
    }

    // Extract RSS feed URL
    const rssPattern = /<link[^>]*rel="alternate"[^>]*type="application\/rss\+xml"[^>]*href="([^"]+)"/i;
    const rssMatch = html.match(rssPattern);
    const rssUrl = rssMatch ? new URL(rssMatch[1], episodeUrl).href : undefined;

    // If transcript found in HTML, clean and return
    if (transcriptContent) {
      const text = transcriptContent
        .replace(/<script[^>]*>.*?<\/script>/gis, "")
        .replace(/<style[^>]*>.*?<\/style>/gis, "")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/section>/gi, "\n")
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/\s+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      if (text.length > 100) {
        return {
          success: true,
          transcript: text,
          title,
          audioUrl,
          rssUrl,
        };
      }
    }

    // Transcript not found in HTML, but we have metadata
    return {
      success: false,
      transcript: "",
      title,
      audioUrl,
      rssUrl,
    };
  } catch (error) {
    console.error("Error extracting from Podbean:", error);
    return { success: false, transcript: "" };
  }
}

/**
 * Attempts to extract transcript from Podbean RSS feed
 * Sometimes transcripts are stored in RSS metadata
 * Note: Most Podbean episodes don't have transcripts in RSS, this is a best-effort fallback
 */
export async function extractFromPodbeanRSS(
  rssUrl: string,
  episodeUrl?: string // Optional: episode URL to match against RSS items
): Promise<PodbeanExtractResult> {
  try {
    console.log(`[Podbean RSS] Checking RSS feed: ${rssUrl}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(rssUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TranscriptBot/1.0)",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`[Podbean RSS] Failed to fetch RSS: ${response.status}`);
      return { success: false, transcript: "" };
    }

    const xml = await response.text();

    // Extract all RSS items
    const itemPattern = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    const items = Array.from(xml.matchAll(itemPattern));

    // If we have an episode URL, try to find matching item
    let targetItem: string | null = null;
    if (episodeUrl) {
      for (const itemMatch of items) {
        const itemContent = itemMatch[1];
        const linkMatch = itemContent.match(/<link[^>]*>(.*?)<\/link>/i);
        if (linkMatch && linkMatch[1].includes(new URL(episodeUrl).pathname)) {
          targetItem = itemContent;
          console.log(`[Podbean RSS] Found matching episode in RSS`);
          break;
        }
      }
    }

    // If no matching item found, use first item as fallback
    if (!targetItem && items.length > 0) {
      targetItem = items[0][1];
    }

    // Look for transcript in the item content
    if (targetItem) {
      const transcriptPatterns = [
        /<itunes:transcript[^>]*>([\s\S]*?)<\/itunes:transcript>/i,
        /<transcript[^>]*>([\s\S]*?)<\/transcript>/i,
        /<podbean:transcript[^>]*>([\s\S]*?)<\/podbean:transcript>/i,
        // Check description for long text (might be transcript)
        /<description[^>]*><!\[CDATA\[([\s\S]{500,}?)\]\]><\/description>/i,
        /<description[^>]*>([\s\S]{500,}?)<\/description>/i,
        /<content:encoded[^>]*><!\[CDATA\[([\s\S]{500,}?)\]\]><\/content:encoded>/i,
        /<content:encoded[^>]*>([\s\S]{500,}?)<\/content:encoded>/i,
      ];

      for (const pattern of transcriptPatterns) {
        const match = targetItem.match(pattern);
        if (match && match[1]) {
          let text = match[1];

          // Clean HTML tags and entities
          text = text
            .replace(/<[^>]*>/g, " ") // Remove HTML tags
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&#8217;/g, "'")
            .replace(/&#8220;/g, '"')
            .replace(/&#8221;/g, '"')
            .replace(/&#8211;/g, "-")
            .replace(/&#8212;/g, "--")
            .replace(/\s+/g, " ") // Normalize whitespace
            .trim();

          // Only accept if it looks like a transcript (long enough, not just metadata)
          if (text.length > 500 && !text.match(/^(https?:\/\/|www\.|podbean\.com)/i)) {
            // Extract title from RSS item
            const titleMatch = targetItem.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>/i) ||
                              targetItem.match(/<title[^>]*>(.*?)<\/title>/i);
            const title = titleMatch ? titleMatch[1].trim() : undefined;

            // Extract audio URL
            const enclosureMatch = targetItem.match(
              /<enclosure[^>]*url="([^"]+\.mp3[^"]*)"[^>]*>/i
            );
            const audioUrl = enclosureMatch ? enclosureMatch[1] : undefined;

            console.log(`[Podbean RSS] Found transcript in RSS (${text.length} chars)`);
            return {
              success: true,
              transcript: text,
              title,
              audioUrl,
              rssUrl,
            };
          }
        }
      }
    }

    console.log(`[Podbean RSS] No transcript found in RSS feed`);
    return { success: false, transcript: "" };
  } catch (error) {
    console.error("[Podbean RSS] Error extracting from RSS:", error);
    return { success: false, transcript: "" };
  }
}
