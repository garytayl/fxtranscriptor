/**
 * Extract metadata from transcripts/descriptions
 * Parses patterns like:
 * [SERIES] Isaiah: The Holy One of Israel     [SPEAKER] Mat Shockney     [SUMMARY] We all come to a place...
 */

export interface SermonMetadata {
  series: string | null;
  speaker: string | null;
  summary: string | null;
}

/**
 * Extract metadata from text (transcript or description)
 * Looks for patterns like [SERIES], [SPEAKER], [SUMMARY]
 */
export function extractMetadata(text: string | null | undefined): SermonMetadata {
  if (!text || typeof text !== 'string') {
    return { series: null, speaker: null, summary: null };
  }

  const metadata: SermonMetadata = {
    series: null,
    speaker: null,
    summary: null,
  };

  // Pattern to match [SERIES], [SPEAKER], [SUMMARY] tags
  // Matches: [SERIES] content     [SPEAKER] content     [SUMMARY] content
  const seriesMatch = text.match(/\[SERIES\]\s*([^\[]+?)(?=\s*\[(?:SPEAKER|SUMMARY)\]|$)/i);
  const speakerMatch = text.match(/\[SPEAKER\]\s*([^\[]+?)(?=\s*\[(?:SERIES|SUMMARY)\]|$)/i);
  const summaryMatch = text.match(/\[SUMMARY\]\s*([^\[]+?)(?=\s*\[(?:SERIES|SPEAKER)\]|$)/i);

  if (seriesMatch) {
    metadata.series = seriesMatch[1].trim();
  }

  if (speakerMatch) {
    metadata.speaker = speakerMatch[1].trim();
  }

  if (summaryMatch) {
    metadata.summary = summaryMatch[1].trim();
  }

  return metadata;
}

/**
 * Remove metadata tags from transcript text
 * Useful for cleaning transcripts before display
 */
export function removeMetadataFromTranscript(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Remove [SERIES], [SPEAKER], [SUMMARY] tags and their content
  return text
    .replace(/\[SERIES\]\s*[^\[]+?(?=\s*\[(?:SPEAKER|SUMMARY)\]|$)/gi, '')
    .replace(/\[SPEAKER\]\s*[^\[]+?(?=\s*\[(?:SERIES|SUMMARY)\]|$)/gi, '')
    .replace(/\[SUMMARY\]\s*[^\[]+?(?=\s*\[(?:SERIES|SPEAKER)\]|$)/gi, '')
    .trim();
}
