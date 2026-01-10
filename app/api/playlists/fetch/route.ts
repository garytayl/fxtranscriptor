/**
 * API Route: Fetch YouTube Playlists
 * Fetches playlist data and matches it to existing sermons
 * Returns series mapping based on playlists
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchYouTubePlaylist, extractPlaylistId } from "@/lib/fetchYouTubePlaylist";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const playlistUrls = body.playlistUrls || [];
    
    // Support single playlist URL or array
    const playlists = Array.isArray(playlistUrls) ? playlistUrls : [playlistUrls];
    
    if (playlists.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No playlist URLs provided",
      }, { status: 400 });
    }

    // Get YouTube API key if available
    const youtubeApiKey = process.env.YOUTUBE_API_KEY;

    // Get all sermons with YouTube video IDs
    const { data: sermons, error: sermonsError } = await supabase
      .from("sermons")
      .select("id, youtube_video_id, title")
      .not("youtube_video_id", "is", null);

    if (sermonsError) {
      throw new Error(`Failed to fetch sermons: ${sermonsError.message}`);
    }

    const sermonMap = new Map<string, typeof sermons[0]>();
    for (const sermon of sermons || []) {
      if (sermon.youtube_video_id) {
        sermonMap.set(sermon.youtube_video_id, sermon);
      }
    }

    // Fetch each playlist and match to sermons
    const playlistSeries = [];
    
    for (const playlistUrl of playlists) {
      try {
        const playlistId = extractPlaylistId(playlistUrl);
        if (!playlistId) {
          console.warn(`[Playlist API] Invalid playlist URL: ${playlistUrl}`);
          continue;
        }

        const playlist = await fetchYouTubePlaylist(playlistId, youtubeApiKey);
        
        if (!playlist || playlist.videoIds.length === 0) {
          console.warn(`[Playlist API] Playlist empty or not found: ${playlistUrl}`);
          continue;
        }

        // Match videos in playlist to sermons
        const matchedSermons = playlist.videoIds
          .map(videoId => sermonMap.get(videoId))
          .filter((sermon): sermon is NonNullable<typeof sermon> => sermon !== undefined);

        if (matchedSermons.length > 0) {
          playlistSeries.push({
            playlistId: playlist.playlistId,
            playlistTitle: playlist.title,
            playlistUrl: `https://www.youtube.com/playlist?list=${playlist.playlistId}`,
            seriesName: cleanPlaylistTitle(playlist.title),
            videoCount: playlist.videoIds.length,
            matchedSermonCount: matchedSermons.length,
            sermonIds: matchedSermons.map(s => s.id),
          });
        }
      } catch (error) {
        console.error(`[Playlist API] Error processing playlist ${playlistUrl}:`, error);
        // Continue with other playlists
      }
    }

    return NextResponse.json({
      success: true,
      playlists: playlistSeries,
      summary: {
        totalPlaylists: playlists.length,
        matchedPlaylists: playlistSeries.length,
        totalMatchedSermons: playlistSeries.reduce((sum, p) => sum + p.matchedSermonCount, 0),
      },
    });
  } catch (error) {
    console.error("[Playlist API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function cleanPlaylistTitle(title: string): string {
  // Clean playlist title to use as series name
  // Removes YouTube-specific suffixes but preserves the actual series name
  return title
    .replace(/\s*-\s*YouTube$/, '') // Remove "- YouTube" suffix
    .replace(/\s*\([^)]*\)$/, '') // Remove parenthetical notes at end
    .replace(/\s*\[[^\]]*\]$/, '') // Remove bracket notes at end
    .replace(/\s*by\s+[^-]+$/, '') // Remove "by Channel Name" suffix
    .trim();
}
