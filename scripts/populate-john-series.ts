/**
 * Script to populate the John series with all sermons from the YouTube playlist
 * 
 * Usage:
 *   npx tsx scripts/populate-john-series.ts
 * 
 * Or if you have ts-node:
 *   npx ts-node scripts/populate-john-series.ts
 */

import { fetchYouTubePlaylist, extractPlaylistId } from "../lib/fetchYouTubePlaylist";
import { fetchPlaylistVideosWithTitles } from "../lib/fetchPlaylistVideosWithTitles";
import { supabase } from "../lib/supabase";

const JOHN_PLAYLIST_URL = "https://youtube.com/playlist?list=PLQwpPWOYg4MOLr9lUNMBgjCCV0ifkKMDu";

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

async function main() {
  try {
    if (!supabase) {
      console.error("❌ Supabase not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
      process.exit(1);
    }

    const playlistId = extractPlaylistId(JOHN_PLAYLIST_URL);
    if (!playlistId) {
      console.error("❌ Invalid playlist URL");
      process.exit(1);
    }

    // Get YouTube API key
    const youtubeApiKey = process.env.YOUTUBE_API_KEY;

    // Fetch playlist
    console.log(`📥 Fetching playlist: ${JOHN_PLAYLIST_URL}`);
    const playlist = await fetchYouTubePlaylist(playlistId, youtubeApiKey);
    
    if (!playlist || playlist.videoIds.length === 0) {
      console.error("❌ Playlist not found or empty");
      process.exit(1);
    }

    console.log(`✅ Found ${playlist.videoIds.length} videos in playlist "${playlist.title}"\n`);

    // Fetch video details if API key is available
    let videoDetails: Array<{
      videoId: string;
      title: string;
      description: string;
      publishedAt: Date | null;
      thumbnailUrl: string | null;
    }> = [];

    if (youtubeApiKey) {
      console.log(`📥 Fetching video details for ${playlist.videoIds.length} videos via API...`);
      videoDetails = await fetchVideoDetails(playlist.videoIds, youtubeApiKey);
      console.log(`✅ Fetched details for ${videoDetails.length} videos\n`);
    } else {
      // Try to get titles from scraping the playlist page
      console.log(`📥 Fetching video titles from playlist page (no API key)...`);
      const playlistVideos = await fetchPlaylistVideosWithTitles(playlistId);
      
      if (playlistVideos.length > 0) {
        console.log(`✅ Extracted ${playlistVideos.length} video titles from playlist page\n`);
        // Convert to videoDetails format
        videoDetails = playlistVideos.map(v => ({
          videoId: v.videoId,
          title: v.title,
          description: '',
          publishedAt: null,
          thumbnailUrl: null,
        }));
      } else {
        console.warn(`⚠️  Could not extract titles from playlist page - will create sermons with video IDs only\n`);
      }
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

    console.log(`📊 Found ${existingSermonMap.size} existing sermons in database\n`);

    // Process each video in the playlist
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < playlist.videoIds.length; i++) {
      const videoId = playlist.videoIds[i];
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
              console.log(`[${i + 1}/${playlist.videoIds.length}] ✅ Updated: ${videoDetail.title.substring(0, 60)}...`);
            } else {
              results.skipped++;
              console.log(`[${i + 1}/${playlist.videoIds.length}] ⏭️  Skipped (no changes): ${existingSermon.title.substring(0, 60)}...`);
            }
          } else {
            results.skipped++;
            console.log(`[${i + 1}/${playlist.videoIds.length}] ⏭️  Skipped (no details): ${existingSermon.title.substring(0, 60)}...`);
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
            console.warn(`⚠️  Failed to add sermon source:`, sourceError);
          }
        }

        results.created++;
        console.log(`[${i + 1}/${playlist.videoIds.length}] ✨ Created: ${title.substring(0, 60)}...`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.errors.push(`Video ${videoId}: ${errorMsg}`);
        console.error(`[${i + 1}/${playlist.videoIds.length}] ❌ Error processing video ${videoId}:`, errorMsg);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Total videos in playlist: ${playlist.videoIds.length}`);
    console.log(`   ✨ Sermons created: ${results.created}`);
    console.log(`   ✅ Sermons updated: ${results.updated}`);
    console.log(`   ⏭️  Sermons skipped: ${results.skipped}`);
    console.log(`   ❌ Errors: ${results.errors.length}`);
    
    if (results.errors.length > 0) {
      console.log(`\n❌ Errors:`);
      results.errors.forEach(err => console.log(`   - ${err}`));
    }

    console.log(`\n✅ Done! The John series should now have all ${playlist.videoIds.length} videos.`);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
