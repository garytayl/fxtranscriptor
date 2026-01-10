/**
 * Extract sermon series from sermon titles
 * Handles various patterns like:
 * - "Series Name - Part 1"
 * - "Series Name: Episode 1"
 * - "Series Name | Part 2"
 * - "Series Name — Part 3"
 * - "Series Name, Part 4"
 * - "Part 1: Series Name"
 * - "Episode 1 - Series Name"
 */

import { Sermon } from './supabase';

export interface SermonSeries {
  id: string; // Generated from series name (slug)
  name: string; // Display name
  sermons: Sermon[];
  sermonCount: number;
  transcriptCount: number;
  latestDate: string | null;
  oldestDate: string | null;
}

/**
 * Extract series name from sermon title
 */
export function extractSeriesName(title: string): string | null {
  if (!title) return null;

  // Common patterns to detect series
  const patterns = [
    // "Series Name - Part 1", "Series Name — Part 1", "Series Name | Part 1"
    /^(.+?)\s*[-—|]\s*(?:Part|Episode|Pt|Ep|#)\s*\d+/i,
    // "Series Name: Part 1", "Series Name: Episode 1"
    /^(.+?):\s*(?:Part|Episode|Pt|Ep|#)\s*\d+/i,
    // "Series Name, Part 1"
    /^(.+?),\s*(?:Part|Episode|Pt|Ep|#)\s*\d+/i,
    // "Part 1: Series Name", "Episode 1: Series Name"
    /^(?:Part|Episode|Pt|Ep|#)\s*\d+:\s*(.+)$/i,
    // "Part 1 - Series Name", "Episode 1 - Series Name"
    /^(?:Part|Episode|Pt|Ep|#)\s*\d+\s*[-—|]\s*(.+)$/i,
    // "Series Name 1", "Series Name 2" (numbers at the end)
    /^(.+?)\s+\d+$/,
    // "Series Name (Part 1)", "Series Name (Episode 1)"
    /^(.+?)\s*\((?:Part|Episode|Pt|Ep|#)\s*\d+\)/i,
    // Common sermon series patterns: "25-01", "25-02" (year-episode format)
    /^(\d{2,4}-\d{1,3})/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      // Extract series name (could be in group 1 or group 2 depending on pattern)
      const seriesName = match[1] || match[2];
      if (seriesName) {
        // Clean up the series name
        return seriesName.trim().replace(/^(25-|FX\s*|fx\s*|fxchurch\s*)/i, '').trim() || null;
      }
    }
  }

  // If no pattern matches, try to extract common prefixes that might indicate series
  // Look for patterns like "SERIES: Name", "Series Name -", etc.
  const prefixPatterns = [
    /^(?:series|sermon|teaching):\s*(.+)/i,
    /^(.+?)\s*[-—|]\s*$/i,
  ];

  for (const pattern of prefixPatterns) {
    const match = title.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim();
      // Only use if it's substantial (more than 3 characters) and doesn't look like a full sermon title
      if (extracted.length > 3 && extracted.length < 50) {
        return extracted;
      }
    }
  }

  return null;
}

/**
 * Generate a slug ID from series name
 */
function generateSeriesId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Group sermons by series
 */
export function groupSermonsBySeries(sermons: Sermon[]): {
  series: SermonSeries[];
  ungrouped: Sermon[];
} {
  const seriesMap = new Map<string, SermonSeries>();
  const ungrouped: Sermon[] = [];

  for (const sermon of sermons) {
    const seriesName = extractSeriesName(sermon.title);

    if (seriesName) {
      const seriesId = generateSeriesId(seriesName);
      
      if (!seriesMap.has(seriesId)) {
        seriesMap.set(seriesId, {
          id: seriesId,
          name: seriesName,
          sermons: [],
          sermonCount: 0,
          transcriptCount: 0,
          latestDate: null,
          oldestDate: null,
        });
      }

      const series = seriesMap.get(seriesId)!;
      series.sermons.push(sermon);
      series.sermonCount++;
      if (sermon.transcript) {
        series.transcriptCount++;
      }

      // Update date range
      if (sermon.date) {
        if (!series.latestDate || sermon.date > series.latestDate) {
          series.latestDate = sermon.date;
        }
        if (!series.oldestDate || sermon.date < series.oldestDate) {
          series.oldestDate = sermon.date;
        }
      }
    } else {
      ungrouped.push(sermon);
    }
  }

  // Sort sermons within each series by date (newest first)
  for (const series of seriesMap.values()) {
    series.sermons.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
  }

  // Convert map to array and sort by latest date (newest first)
  const seriesArray = Array.from(seriesMap.values()).sort((a, b) => {
    const dateA = a.latestDate ? new Date(a.latestDate).getTime() : 0;
    const dateB = b.latestDate ? new Date(b.latestDate).getTime() : 0;
    return dateB - dateA;
  });

  // Sort ungrouped sermons by date (newest first)
  ungrouped.sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });

  return {
    series: seriesArray,
    ungrouped,
  };
}

/**
 * Get a series by ID
 */
export function getSeriesById(series: SermonSeries[], seriesId: string): SermonSeries | undefined {
  return series.find(s => s.id === seriesId);
}
