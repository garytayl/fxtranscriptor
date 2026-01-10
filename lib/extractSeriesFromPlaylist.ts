/**
 * Extract sermon series from YouTube playlists
 * Uses playlist structure to auto-organize sermons into series
 */

import { Sermon } from './supabase';
import { YouTubePlaylist, fetchYouTubePlaylist } from './fetchYouTubePlaylist';

export interface PlaylistSeriesInfo {
  playlistId: string;
  playlistTitle: string;
  videoIds: string[];
}

/**
 * Group sermons by YouTube playlist
 * Matches sermons with youtube_video_id to videos in playlists
 */
export async function extractSeriesFromPlaylists(
  sermons: Sermon[],
  playlistUrls: string[],
  apiKey?: string
): Promise<Map<string, PlaylistSeriesInfo>> {
  const playlistSeriesMap = new Map<string, PlaylistSeriesInfo>();
  const sermonVideoIdMap = new Map<string, Sermon>();

  // Create a map of video IDs to sermons for quick lookup
  for (const sermon of sermons) {
    if (sermon.youtube_video_id) {
      sermonVideoIdMap.set(sermon.youtube_video_id, sermon);
    }
  }

  // Fetch each playlist and match videos to sermons
  for (const playlistUrl of playlistUrls) {
    try {
      console.log(`[Playlist Series] Fetching playlist: ${playlistUrl}`);
      const playlist = await fetchYouTubePlaylist(playlistUrl, apiKey);

      if (!playlist || playlist.videoIds.length === 0) {
        console.warn(`[Playlist Series] Playlist empty or not found: ${playlistUrl}`);
        continue;
      }

      // Check if any sermons match videos in this playlist
      const matchingVideoIds = playlist.videoIds.filter(id => sermonVideoIdMap.has(id));
      
      if (matchingVideoIds.length > 0) {
        playlistSeriesMap.set(playlist.playlistId, {
          playlistId: playlist.playlistId,
          playlistTitle: playlist.title,
          videoIds: matchingVideoIds,
        });
        console.log(`[Playlist Series] ✅ Matched playlist "${playlist.title}" with ${matchingVideoIds.length} sermons`);
      } else {
        console.log(`[Playlist Series] No sermons matched to playlist "${playlist.title}"`);
      }
    } catch (error) {
      console.error(`[Playlist Series] Error fetching playlist ${playlistUrl}:`, error);
      // Continue with other playlists
    }
  }

  return playlistSeriesMap;
}

/**
 * Update sermon series names based on playlist data
 * Returns a map of sermon IDs to their playlist-based series names
 */
export function assignSeriesFromPlaylists(
  sermons: Sermon[],
  playlistSeriesMap: Map<string, PlaylistSeriesInfo>
): Map<string, string> {
  const sermonSeriesMap = new Map<string, string>();

  for (const [playlistId, playlistInfo] of playlistSeriesMap.entries()) {
    for (const videoId of playlistInfo.videoIds) {
      // Find sermon with this video ID
      const sermon = sermons.find(s => s.youtube_video_id === videoId);
      if (sermon) {
        // Use playlist title as series name (clean it up)
        const seriesName = cleanPlaylistTitle(playlistInfo.playlistTitle);
        sermonSeriesMap.set(sermon.id, seriesName);
      }
    }
  }

  return sermonSeriesMap;
}

/**
 * Clean playlist title to use as series name
 * Removes common suffixes and formatting
 */
function cleanPlaylistTitle(title: string): string {
  return title
    .replace(/\s*-\s*YouTube$/, '')
    .replace(/\s*\([^)]*\)$/, '') // Remove parenthetical notes at end
    .replace(/\s*\[[^\]]*\]$/, '') // Remove brackets at end
    .trim();
}

/**
 * Enhanced series grouping that prioritizes playlist data over title extraction
 */
export function groupSermonsBySeriesWithPlaylists(
  sermons: Sermon[],
  playlistSeriesMap: Map<string, string>
): {
  series: Array<{
    id: string;
    name: string;
    sermons: Sermon[];
    sermonCount: number;
    transcriptCount: number;
    latestDate: string | null;
    oldestDate: string | null;
  }>;
  ungrouped: Sermon[];
} {
  const seriesMap = new Map<string, {
    id: string;
    name: string;
    sermons: Sermon[];
    sermonCount: number;
    transcriptCount: number;
    latestDate: string | null;
    oldestDate: string | null;
  }>();
  const ungrouped: Sermon[] = [];

  // First pass: Assign series from playlists (priority)
  for (const sermon of sermons) {
    const playlistSeriesName = playlistSeriesMap.get(sermon.id);
    
    if (playlistSeriesName) {
      // Use playlist-based series name
      const seriesId = generateSeriesId(playlistSeriesName);
      
      if (!seriesMap.has(seriesId)) {
        seriesMap.set(seriesId, {
          id: seriesId,
          name: playlistSeriesName,
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
    }
  }

  // Second pass: Group remaining sermons by title extraction
  for (const sermon of sermons) {
    // Skip if already assigned to a playlist series
    if (playlistSeriesMap.has(sermon.id)) {
      continue;
    }

    // Try title-based extraction as fallback
    const seriesName = extractSeriesNameFromTitle(sermon.title);

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
 * Generate a slug ID from series name
 */
function generateSeriesId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Extract series name from sermon title (fallback method)
 */
function extractSeriesNameFromTitle(title: string): string | null {
  if (!title) return null;

  // Common patterns to detect series
  const patterns = [
    /^(.+?)\s*[-—|]\s*(?:Part|Episode|Pt|Ep|#)\s*\d+/i,
    /^(.+?):\s*(?:Part|Episode|Pt|Ep|#)\s*\d+/i,
    /^(.+?),\s*(?:Part|Episode|Pt|Ep|#)\s*\d+/i,
    /^(?:Part|Episode|Pt|Ep|#)\s*\d+:\s*(.+)$/i,
    /^(?:Part|Episode|Pt|Ep|#)\s*\d+\s*[-—|]\s*(.+)$/i,
    /^(.+?)\s+\d+$/,
    /^(.+?)\s*\((?:Part|Episode|Pt|Ep|#)\s*\d+\)/i,
    /^(\d{2,4}-\d{1,3})/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      const seriesName = match[1] || match[2];
      if (seriesName) {
        return seriesName.trim().replace(/^(25-|FX\s*|fx\s*|fxchurch\s*)/i, '').trim() || null;
      }
    }
  }

  return null;
}
