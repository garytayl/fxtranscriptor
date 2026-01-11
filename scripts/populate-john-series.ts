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
import { fetchPodbeanCatalog } from "../lib/fetchPodbeanCatalog";
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

    // Fetch Podbean catalog to match for audio URLs
    console.log(`📥 Fetching Podbean catalog to match for audio URLs...`);
    let podbeanEpisodes: any[] = [];
    try {
      const podbeanRssUrl = process.env.PODBEAN_RSS_URL || "https://feed.podbean.com/fxtalk/feed.xml";
      podbeanEpisodes = await fetchPodbeanCatalog(podbeanRssUrl);
      console.log(`✅ Fetched ${podbeanEpisodes.length} Podbean episodes\n`);
    } catch (podbeanError) {
      console.warn(`⚠️  Failed to fetch Podbean catalog: ${podbeanError}. Continuing without audio URL matching.\n`);
    }

    // Helper function to normalize titles for matching
    function normalizeTitleForMatch(title: string): string {
      return title
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    // Helper function to calculate simple title similarity
    function calculateSimpleTitleSimilarity(title1: string, title2: string): number {
      const words1 = new Set(title1.split(' ').filter(w => w.length > 2));
      const words2 = new Set(title2.split(' ').filter(w => w.length > 2));
      const intersection = new Set([...words1].filter(x => words2.has(x)));
      const union = new Set([...words1, ...words2]);
      return union.size === 0 ? 0 : intersection.size / union.size;
    }

    // Helper function to parse date from YouTube title like "Sunday Service - 1/11/2026"
    function parseDateFromTitle(title: string): Date | null {
      // Try patterns like "Sunday Service - 1/11/2026" or "Sunday Service - 12/28/2025"
      const datePatterns = [
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // M/D/YYYY or MM/DD/YYYY
        /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
      ];

      for (const pattern of datePatterns) {
        const match = title.match(pattern);
        if (match) {
          if (pattern === datePatterns[0]) {
            // M/D/YYYY format
            const month = parseInt(match[1], 10);
            const day = parseInt(match[2], 10);
            const year = parseInt(match[3], 10);
            return new Date(year, month - 1, day);
          } else {
            // YYYY-MM-DD format
            return new Date(match[0]);
          }
        }
      }
      return null;
    }

    // Helper function to find best Podbean match for a sermon
    function findBestPodbeanMatch(sermonTitle: string, sermonDate: Date | null): typeof podbeanEpisodes[0] | null {
      if (podbeanEpisodes.length === 0) return null;

      // If no date provided, try to parse from title
      let actualDate = sermonDate;
      if (!actualDate) {
        actualDate = parseDateFromTitle(sermonTitle);
      }

      const normalizedSermonTitle = normalizeTitleForMatch(sermonTitle);
      // Use a wider date window for matching - sermons might be published on different days
      const DATE_WINDOW_DAYS = 7;

      // First try date-based matching
      if (actualDate) {
        const candidates = podbeanEpisodes
          .filter(pb => pb.date)
          .map(pb => {
            const daysDiff = Math.abs((actualDate!.getTime() - pb.date.getTime()) / (1000 * 60 * 60 * 24));
            const normalizedPodbeanTitle = normalizeTitleForMatch(pb.title);
            const titleSimilarity = calculateSimpleTitleSimilarity(normalizedSermonTitle, normalizedPodbeanTitle);
            return { episode: pb, daysDiff, titleSimilarity };
          })
          .filter(c => c.daysDiff <= DATE_WINDOW_DAYS)
          .sort((a, b) => {
            if (Math.abs(a.daysDiff - b.daysDiff) > 0.1) {
              return a.daysDiff - b.daysDiff;
            }
            return b.titleSimilarity - a.titleSimilarity;
          });

        if (candidates.length > 0) {
          return candidates[0].episode;
        }
      }

      // Fallback to title-based matching
      const titleMatch = podbeanEpisodes.find(pb => {
        const normalizedPodbeanTitle = normalizeTitleForMatch(pb.title);
        const titleSimilarity = calculateSimpleTitleSimilarity(normalizedSermonTitle, normalizedPodbeanTitle);
        return titleSimilarity >= 0.6;
      });

      return titleMatch || null;
    }

    // Process each video in the playlist
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      matchedWithPodbean: 0,
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

            // Try to match with Podbean episode for audio URL if not already set
            if (!existingSermon.audio_url && podbeanEpisodes.length > 0) {
              const parsedDate = parseDateFromTitle(videoDetail.title);
              if (parsedDate) {
                console.log(`[${i + 1}/${playlist.videoIds.length}] 📅 Parsed date from title "${videoDetail.title}": ${parsedDate.toISOString().split('T')[0]}`);
              }
              const podbeanMatch = findBestPodbeanMatch(videoDetail.title, videoDetail.publishedAt || parsedDate || null);
              if (podbeanMatch) {
                updateData.audio_url = podbeanMatch.audioUrl || null;
                updateData.podbean_url = podbeanMatch.url || null;
                results.matchedWithPodbean++;
                console.log(`[${i + 1}/${playlist.videoIds.length}] 🎵 Matched with Podbean: ${podbeanMatch.title.substring(0, 50)}... (date: ${podbeanMatch.date.toISOString().split('T')[0]})`);
              } else if (parsedDate) {
                // Show why it didn't match
                const closestEpisodes = podbeanEpisodes
                  .filter(pb => pb.date)
                  .map(pb => ({
                    title: pb.title,
                    date: pb.date,
                    daysDiff: Math.abs((parsedDate.getTime() - pb.date.getTime()) / (1000 * 60 * 60 * 24))
                  }))
                  .sort((a, b) => a.daysDiff - b.daysDiff)
                  .slice(0, 3);
                console.log(`[${i + 1}/${playlist.videoIds.length}] ⚠️  No Podbean match found. Closest episodes: ${closestEpisodes.map(e => `${e.date.toISOString().split('T')[0]} (${e.daysDiff.toFixed(0)} days)`).join(', ')}`);
              }
            }

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
        const sermonDate = videoDetail?.publishedAt || null;
        
        // Try to match with Podbean episode for audio URL
        let podbeanMatch = null;
        let audioUrl = null;
        let podbeanUrl = null;
        
        if (podbeanEpisodes.length > 0) {
          podbeanMatch = findBestPodbeanMatch(title, sermonDate);
          if (podbeanMatch) {
            audioUrl = podbeanMatch.audioUrl || null;
            podbeanUrl = podbeanMatch.url || null;
            results.matchedWithPodbean++;
            console.log(`[${i + 1}/${playlist.videoIds.length}] 🎵 Matched with Podbean: ${podbeanMatch.title.substring(0, 50)}...`);
          }
        }

        const sermonData = {
          title,
          date: sermonDate?.toISOString() || null,
          description: videoDetail?.description || null,
          podbean_url: podbeanUrl,
          youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
          youtube_video_id: videoId,
          audio_url: audioUrl,
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
    console.log(`   🎵 Matched with Podbean (audio URLs): ${results.matchedWithPodbean}`);
    console.log(`   ❌ Errors: ${results.errors.length}`);
    
    if (results.errors.length > 0) {
      console.log(`\n❌ Errors:`);
      results.errors.forEach(err => console.log(`   - ${err}`));
    }

    if (results.matchedWithPodbean === 0 && podbeanEpisodes.length > 0) {
      console.log(`\n⚠️  Note: No audio URLs were matched. This could mean:`);
      console.log(`   - The John series sermons (Aug 2025 - Jan 2026) are not yet in Podbean`);
      console.log(`   - Podbean episodes use different titles or dates`);
      console.log(`   - You may need to manually set audio URLs via the UI`);
      console.log(`   - Or run the catalog sync to match them: npm run dev, then click "Sync Catalog"`);
    }

    console.log(`\n✅ Done! The John series should now have all ${playlist.videoIds.length} videos.`);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
