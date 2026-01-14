/**
 * Bible Gateway URL helper functions
 * Generates links to Bible Gateway with HCSB translation
 */

import type { SermonChunkVerse } from "@/lib/supabase";

/**
 * Normalize book names for Bible Gateway URLs
 * Converts formats like "Second Corinthians" to "2 Corinthians"
 */
function normalizeBookName(book: string): string {
  // Handle common variations
  const replacements: Record<string, string> = {
    "First": "1",
    "Second": "2",
    "Third": "3",
    "1st": "1",
    "2nd": "2",
    "3rd": "3",
  };

  let normalized = book.trim();

  // Replace ordinal prefixes
  for (const [prefix, replacement] of Object.entries(replacements)) {
    if (normalized.startsWith(`${prefix} `)) {
      normalized = normalized.replace(`${prefix} `, `${replacement} `);
      break;
    }
  }

  return normalized;
}

/**
 * Generate a Bible Gateway URL for a verse reference
 * @param verse The verse reference object
 * @param translation The Bible translation (default: HCSB)
 * @returns URL string for Bible Gateway
 */
export function getBibleGatewayUrl(
  verse: SermonChunkVerse,
  translation: string = "HCSB"
): string {
  const book = normalizeBookName(verse.book);
  const bookEncoded = encodeURIComponent(book);
  
  // Build the passage reference
  let passage = `${book}+${verse.chapter}:${verse.verse_start}`;
  if (verse.verse_end && verse.verse_end !== verse.verse_start) {
    passage += `-${verse.verse_end}`;
  }
  
  const passageEncoded = encodeURIComponent(passage);
  
  return `https://www.biblegateway.com/passage/?search=${passageEncoded}&version=${translation}`;
}

/**
 * Generate a Bible Gateway URL from a full reference string
 * @param fullReference The full reference (e.g., "2 Chronicles 32:6-7")
 * @param translation The Bible translation (default: HCSB)
 * @returns URL string for Bible Gateway
 */
export function getBibleGatewayUrlFromReference(
  fullReference: string,
  translation: string = "HCSB"
): string {
  const referenceEncoded = encodeURIComponent(fullReference);
  return `https://www.biblegateway.com/passage/?search=${referenceEncoded}&version=${translation}`;
}
