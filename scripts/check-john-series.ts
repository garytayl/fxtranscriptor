/**
 * Diagnostic script to check why only one sermon appears in the John series
 */

import { fetchYouTubePlaylist, extractPlaylistId } from "../lib/fetchYouTubePlaylist";
import { supabase } from "../lib/supabase";

const JOHN_PLAYLIST_URL = "https://youtube.com/playlist?list=PLQwpPWOYg4MOLr9lUNMBgjCCV0ifkKMDu";

async function main() {
  try {
    if (!supabase) {
      console.error("❌ Supabase not configured");
      process.exit(1);
    }

    // Fetch playlist
    const playlistId = extractPlaylistId(JOHN_PLAYLIST_URL);
    if (!playlistId) {
      console.error("❌ Invalid playlist URL");
      process.exit(1);
    }

    console.log(`📥 Fetching playlist: ${JOHN_PLAYLIST_URL}`);
    const playlist = await fetchYouTubePlaylist(playlistId, process.env.YOUTUBE_API_KEY);
    
    if (!playlist || playlist.videoIds.length === 0) {
      console.error("❌ Playlist not found or empty");
      process.exit(1);
    }

    console.log(`✅ Playlist has ${playlist.videoIds.length} videos\n`);

    // Get all sermons with YouTube video IDs
    const { data: sermons, error: sermonsError } = await supabase
      .from("sermons")
      .select("id, youtube_video_id, title")
      .not("youtube_video_id", "is", null);

    if (sermonsError) {
      throw new Error(`Failed to fetch sermons: ${sermonsError.message}`);
    }

    console.log(`📊 Found ${sermons?.length || 0} sermons with youtube_video_id in database\n`);

    // Create a map of video IDs to sermons
    const sermonMap = new Map<string, typeof sermons[0]>();
    for (const sermon of sermons || []) {
      if (sermon.youtube_video_id) {
        sermonMap.set(sermon.youtube_video_id, sermon);
      }
    }

    // Check which playlist videos match sermons
    const matchingVideoIds: string[] = [];
    const missingVideoIds: string[] = [];

    for (const videoId of playlist.videoIds) {
      if (sermonMap.has(videoId)) {
        matchingVideoIds.push(videoId);
      } else {
        missingVideoIds.push(videoId);
      }
    }

    console.log(`✅ Matching sermons: ${matchingVideoIds.length}/${playlist.videoIds.length}`);
    console.log(`❌ Missing sermons: ${missingVideoIds.length}/${playlist.videoIds.length}\n`);

    if (matchingVideoIds.length > 0) {
      console.log(`📋 Matching sermons:`);
      for (const videoId of matchingVideoIds) {
        const sermon = sermonMap.get(videoId);
        console.log(`   ✅ ${videoId}: ${sermon?.title?.substring(0, 60)}...`);
      }
      console.log();
    }

    if (missingVideoIds.length > 0) {
      console.log(`❌ Missing video IDs (in playlist but not in database):`);
      for (const videoId of missingVideoIds) {
        console.log(`   - ${videoId}`);
      }
      console.log();
    }

    // Check for sermons with video IDs not in playlist
    const extraVideoIds: string[] = [];
    for (const [videoId, sermon] of sermonMap.entries()) {
      if (!playlist.videoIds.includes(videoId)) {
        extraVideoIds.push(videoId);
      }
    }

    if (extraVideoIds.length > 0) {
      console.log(`⚠️  Extra video IDs (in database but not in playlist): ${extraVideoIds.length}`);
      for (const videoId of extraVideoIds.slice(0, 5)) {
        const sermon = sermonMap.get(videoId);
        console.log(`   - ${videoId}: ${sermon?.title?.substring(0, 60)}...`);
      }
      if (extraVideoIds.length > 5) {
        console.log(`   ... and ${extraVideoIds.length - 5} more`);
      }
      console.log();
    }

    // Summary
    console.log(`\n📊 Summary:`);
    console.log(`   Playlist videos: ${playlist.videoIds.length}`);
    console.log(`   Sermons in database with youtube_video_id: ${sermons?.length || 0}`);
    console.log(`   Matching: ${matchingVideoIds.length}`);
    console.log(`   Missing: ${missingVideoIds.length}`);
    console.log(`   Extra: ${extraVideoIds.length}`);

    if (matchingVideoIds.length < playlist.videoIds.length) {
      console.log(`\n⚠️  Only ${matchingVideoIds.length} out of ${playlist.videoIds.length} videos are matched!`);
      console.log(`   This is why only ${matchingVideoIds.length} sermon(s) appear in the series.`);
    } else {
      console.log(`\n✅ All videos are matched!`);
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
