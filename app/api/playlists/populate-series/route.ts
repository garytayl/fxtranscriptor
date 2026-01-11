/**
 * API Route: Populate Series from Playlist
 * Fetches all videos from a playlist and creates/updates sermons for each video
 * This ensures all videos in a playlist are represented as sermons in the database
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchYouTubePlaylist, extractPlaylistId } from "@/lib/fetchYouTubePlaylist";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * Fetch video details from YouTube API
 */
async function fetchVideoDetails(videoIds: string[], apiKey?: string): Promise<Array<{
  videoId: string;
  title: string;
  description: string;
  publishedAt: Date | null;
  thumbnailUrl: string | null;
}>> {
  if (!apiKey || videoIds.length === 0) {
    return [];
  }

  try {
    // YouTube API allows up to 50 videos per request
    const batches: string[][] = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      batches.push(videoIds.slice(i, i + 50));
    }

    const allVideos: Array<{
      videoId: string;
      title: string;
      description: string;
      publishedAt: Date | null;
      thumbnailUrl: string | null;
    }> = [];

    for (const batch of batches) {
      const videoIdsParam = batch.join(',');
      const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoIdsParam}&key=${apiKey}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`[Populate Series] Failed to fetch video details for batch: ${response.status}`);
        continue;
      }

      const data = await response.json();
      for (const item of data.items || []) {
        allVideos.push({
          videoId: item.id,
          title: item.snippet.title,
          description: item.snippet.description || '',
          publishedAt: item.snippet.publishedAt ? new Date(item.snippet.publishedAt) : null,
          thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || null,
        });
      }
    }

    return allVideos;
  } catch (error) {
    console.error('[Populate Series] Error fetching video details:', error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const playlistUrl = body.playlistUrl || body.playlistUrls?.[0];
    
    if (!playlistUrl) {
      return NextResponse.json({
        success: false,
        error: "No playlist URL provided",
      }, { status: 400 });
    }

    const playlistId = extractPlaylistId(playlistUrl);
    if (!playlistId) {
      return NextResponse.json({
        success: false,
        error: "Invalid playlist URL",
      }, { status: 400 });
    }

    // Get YouTube API key
    const youtubeApiKey = process.env.YOUTUBE_API_KEY;

    // Fetch playlist
    console.log(`[Populate Series] Fetching playlist: ${playlistUrl}`);
    const playlist = await fetchYouTubePlaylist(playlistId, youtubeApiKey);
    
    if (!playlist || playlist.videoIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Playlist not found or empty",
      }, { status: 404 });
    }

    console.log(`[Populate Series] Found ${playlist.videoIds.length} videos in playlist "${playlist.title}"`);

    // Fetch video details if API key is available
    let videoDetails: Array<{
      videoId: string;
      title: string;
      description: string;
      publishedAt: Date | null;
      thumbnailUrl: string | null;
    }> = [];

    if (youtubeApiKey) {
      console.log(`[Populate Series] Fetching video details for ${playlist.videoIds.length} videos...`);
      videoDetails = await fetchVideoDetails(playlist.videoIds, youtubeApiKey);
      console.log(`[Populate Series] Fetched details for ${videoDetails.length} videos`);
    } else {
      console.warn(`[Populate Series] No YouTube API key - will create sermons with video IDs only`);
    }

    // Create a map of video IDs to details
    const videoDetailsMap = new Map(
      videoDetails.map(v => [v.videoId, v])
    );

    // Get existing sermons with these video IDs
    const { data: existingSermons, error: sermonsError } = await supabase
      .from("sermons")
      .select("id, youtube_video_id, title")
      .in("youtube_video_id", playlist.videoIds);

    if (sermonsError) {
      throw new Error(`Failed to fetch existing sermons: ${sermonsError.message}`);
    }

    const existingSermonMap = new Map(
      (existingSermons || []).map(s => [s.youtube_video_id, s])
    );

    // Process each video in the playlist
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const videoId of playlist.videoIds) {
      try {
        const videoDetail = videoDetailsMap.get(videoId);
        const existingSermon = existingSermonMap.get(videoId);

        // Skip if sermon already exists with correct video ID
        if (existingSermon) {
          // Update if we have better details
          if (videoDetail) {
            const updateData: any = {
              updated_at: new Date().toISOString(),
            };

            // Update title if different (and new one is not empty)
            if (videoDetail.title && videoDetail.title !== existingSermon.title) {
              updateData.title = videoDetail.title;
            }

            // Update date if we have it
            if (videoDetail.publishedAt) {
              updateData.date = videoDetail.publishedAt.toISOString();
            }

            // Update description if we have it
            if (videoDetail.description) {
              updateData.description = videoDetail.description;
            }

            // Update YouTube URL
            updateData.youtube_url = `https://www.youtube.com/watch?v=${videoId}`;

            // Only update if there are changes
            if (Object.keys(updateData).length > 1) { // More than just updated_at
              const { error: updateError } = await supabase
                .from("sermons")
                .update(updateData)
                .eq("id", existingSermon.id);

              if (updateError) {
                throw new Error(`Update failed: ${updateError.message}`);
              }
              results.updated++;
              console.log(`[Populate Series] Updated sermon: ${videoDetail.title.substring(0, 50)}...`);
            } else {
              results.skipped++;
            }
          } else {
            results.skipped++;
          }
          continue;
        }

        // Create new sermon
        const title = videoDetail?.title || `Video ${videoId}`;
        const sermonData = {
          title,
          date: videoDetail?.publishedAt?.toISOString() || null,
          description: videoDetail?.description || null,
          youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
          youtube_video_id: videoId,
          status: "pending" as const,
        };

        const { data: newSermon, error: insertError } = await supabase
          .from("sermons")
          .insert(sermonData)
          .select()
          .single();

        if (insertError) {
          throw new Error(`Insert failed: ${insertError.message}`);
        }

        // Add sermon source for tracking
        if (newSermon) {
          try {
            await supabase.from("sermon_sources").insert({
              sermon_id: newSermon.id,
              source_type: "youtube",
              source_url: sermonData.youtube_url,
              source_id: videoId,
            });
          } catch (sourceError) {
            // Non-critical - log but continue
            console.warn(`[Populate Series] Failed to add sermon source:`, sourceError);
          }
        }

        results.created++;
        console.log(`[Populate Series] Created sermon: ${title.substring(0, 50)}...`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.errors.push(`Video ${videoId}: ${errorMsg}`);
        console.error(`[Populate Series] Error processing video ${videoId}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      playlist: {
        playlistId: playlist.playlistId,
        playlistTitle: playlist.title,
        videoCount: playlist.videoIds.length,
      },
      results,
      summary: {
        totalVideos: playlist.videoIds.length,
        sermonsCreated: results.created,
        sermonsUpdated: results.updated,
        sermonsSkipped: results.skipped,
        errors: results.errors.length,
      },
    });
  } catch (error) {
    console.error("[Populate Series] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
