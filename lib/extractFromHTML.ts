/**
 * Best-effort HTML extraction for transcripts
 * Tries to locate transcript content from HTML structure
 */

export interface HTMLExtractResult {
  success: boolean;
  transcript: string;
  title?: string;
}

export function extractFromHTML(html: string): HTMLExtractResult {
  if (!html || typeof html !== "string") {
    return { success: false, transcript: "" };
  }

  try {
    // Extract title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    // Common patterns for transcript content in podcast pages
    const transcriptPatterns = [
      // Apple Podcasts specific patterns
      /<div[^>]*class="[^"]*transcript[^"]*"[^>]*>(.*?)<\/div>/is,
      /<section[^>]*data-transcript[^>]*>(.*?)<\/section>/is,
      /<article[^>]*class="[^"]*transcript[^"]*"[^>]*>(.*?)<\/article>/is,
      // Generic content patterns
      /<div[^>]*id="transcript"[^>]*>(.*?)<\/div>/is,
      /<section[^>]*id="transcript"[^>]*>(.*?)<\/section>/is,
      // Script tags with transcript data
      /<script[^>]*type="application\/json"[^>]*data-transcript[^>]*>(.*?)<\/script>/is,
    ];

    let transcriptContent = "";

    for (const pattern of transcriptPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        transcriptContent = match[1];
        break;
      }
    }

    // If no specific transcript container found, try to extract from main content
    if (!transcriptContent) {
      // Look for main content areas
      const mainPatterns = [
        /<main[^>]*>(.*?)<\/main>/is,
        /<article[^>]*>(.*?)<\/article>/is,
        /<div[^>]*class="[^"]*content[^"]*"[^>]*>(.*?)<\/div>/is,
      ];

      for (const pattern of mainPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          transcriptContent = match[1];
          break;
        }
      }
    }

    if (!transcriptContent) {
      return { success: false, transcript: "", title };
    }

    // Clean HTML tags and extract text
    let text = transcriptContent
      // Remove script and style tags
      .replace(/<script[^>]*>.*?<\/script>/gis, "")
      .replace(/<style[^>]*>.*?<\/style>/gis, "")
      // Convert paragraph breaks
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      // Convert div/section breaks
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/section>/gi, "\n")
      // Remove all remaining HTML tags
      .replace(/<[^>]*>/g, "")
      // Decode HTML entities
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      // Normalize whitespace
      .replace(/\s+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return {
      success: text.length > 50, // Require minimum length to consider successful
      transcript: text,
      title,
    };
  } catch (error) {
    console.error("Error extracting from HTML:", error);
    return { success: false, transcript: "" };
  }
}
