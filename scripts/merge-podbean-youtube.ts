/**
 * Script to intelligently merge Podbean and YouTube videos into consolidated sermons
 * 
 * This handles cases where:
 * - Same sermon exists on both platforms (merge into one record)
 * - Sermon only on YouTube (add Podbean if found)
 * - Sermon only on Podbean (add YouTube if found)
 * 
 * Usage:
 *   npx tsx scripts/merge-podbean-youtube.ts
 */

import { fetchPodbeanCatalog } from "../lib/fetchPodbeanCatalog";
import { fetchYouTubeCatalog } from "../lib/fetchYouTubeCatalog";
import { matchSermons } from "../lib/matchSermons";
import { supabase } from "../lib/supabase";

async function main() {
  try {
    if (!supabase) {
      console.error("❌ Supabase not configured");
      process.exit(1);
    }

    console.log("🔄 Starting intelligent merge of Podbean and YouTube sermons...\n");

    // Fetch both catalogs
    console.log("📥 Fetching Podbean catalog...");
    const podbeanRssUrl = process.env.PODBEAN_RSS_URL || "https://feed.podbean.com/fxtalk/feed.xml";
    let podbeanEpisodes: any[] = [];
    try {
      podbeanEpisodes = await fetchPodbeanCatalog(podbeanRssUrl);
      console.log(`✅ Fetched ${podbeanEpisodes.length} Podbean episodes\n`);
    } catch (error) {
      console.error(`❌ Failed to fetch Podbean catalog: ${error}`);
      process.exit(1);
    }

    console.log("📥 Fetching YouTube catalog...");
    const youtubeChannel = process.env.YOUTUBE_CHANNEL_ID || "@fxchurch";
    let youtubeVideos: any[] = [];
    try {
      youtubeVideos = await fetchYouTubeCatalog(youtubeChannel);
      console.log(`✅ Fetched ${youtubeVideos.length} YouTube videos\n`);
    } catch (error) {
      console.error(`❌ Failed to fetch YouTube catalog: ${error}`);
      console.log(`⚠️  Continuing with Podbean-only merge...\n`);
      // Continue with just Podbean episodes if YouTube fails
    }

    // Use the existing matching logic (only if we have both sources)
    let matchedSermons: any[] = [];
    if (youtubeVideos.length > 0) {
      console.log("🔍 Matching Podbean and YouTube videos...");
      matchedSermons = matchSermons(podbeanEpisodes, youtubeVideos);
      console.log(`✅ Matched ${matchedSermons.length} sermons\n`);
    } else {
      console.log("⚠️  Skipping matching (no YouTube videos available)\n");
    }

    // Get all existing sermons from database
    console.log("📥 Loading existing sermons from database...");
    const { data: existingSermons, error: sermonsError } = await supabase
      .from("sermons")
      .select("*");

    if (sermonsError) {
      throw new Error(`Failed to fetch existing sermons: ${sermonsError.message}`);
    }

    console.log(`✅ Found ${existingSermons?.length || 0} existing sermons in database\n`);

    // Create lookup maps
    const sermonsByPodbeanUrl = new Map(
      (existingSermons || [])
        .filter(s => s.podbean_url)
        .map(s => [s.podbean_url, s])
    );

    const sermonsByYouTubeId = new Map(
      (existingSermons || [])
        .filter(s => s.youtube_video_id)
        .map(s => [s.youtube_video_id, s])
    );

    const results = {
      created: 0,
      updated: 0,
      merged: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Process each matched sermon
    console.log("🔄 Processing matched sermons...\n");
    for (let i = 0; i < matchedSermons.length; i++) {
      const matched = matchedSermons[i];
      try {
        // Check if sermon exists by Podbean URL
        let existingSermon = matched.podbeanEpisode?.url
          ? sermonsByPodbeanUrl.get(matched.podbeanEpisode.url)
          : null;

        // Check if sermon exists by YouTube video ID
        if (!existingSermon && matched.youtubeVideo?.videoId) {
          existingSermon = sermonsByYouTubeId.get(matched.youtubeVideo.videoId);
        }

        // Prepare sermon data (merge both sources)
        const sermonData: any = {
          title: matched.title,
          date: matched.date?.toISOString() || null,
          description: matched.description || null,
          podbean_url: matched.podbeanEpisode?.url || null,
          youtube_url: matched.youtubeVideo?.url || null,
          youtube_video_id: matched.youtubeVideo?.videoId || null,
          audio_url: matched.podbeanEpisode?.audioUrl || null,
          status: "pending" as const,
          updated_at: new Date().toISOString(),
        };

        if (existingSermon) {
          // MERGE: Update existing sermon with data from both sources
          const updateData: any = {
            updated_at: new Date().toISOString(),
          };

          // Merge title (prefer matched title if different)
          if (matched.title && matched.title !== existingSermon.title) {
            updateData.title = matched.title;
          }

          // Merge date (prefer matched date if more recent or if existing is null)
          if (matched.date) {
            if (!existingSermon.date || new Date(matched.date) > new Date(existingSermon.date)) {
              updateData.date = matched.date.toISOString();
            }
          }

          // Merge description
          if (matched.description && (!existingSermon.description || matched.description.length > existingSermon.description.length)) {
            updateData.description = matched.description;
          }

          // Merge Podbean URL (if not set)
          if (matched.podbeanEpisode?.url && !existingSermon.podbean_url) {
            updateData.podbean_url = matched.podbeanEpisode.url;
          }

          // Merge YouTube URL and video ID (if not set)
          if (matched.youtubeVideo?.url && !existingSermon.youtube_url) {
            updateData.youtube_url = matched.youtubeVideo.url;
          }
          if (matched.youtubeVideo?.videoId && !existingSermon.youtube_video_id) {
            updateData.youtube_video_id = matched.youtubeVideo.videoId;
          }

          // Merge audio URL (prefer Podbean audio URL if available)
          if (matched.podbeanEpisode?.audioUrl && (!existingSermon.audio_url || existingSermon.audio_url !== matched.podbeanEpisode.audioUrl)) {
            updateData.audio_url = matched.podbeanEpisode.audioUrl;
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

            // Check if this was a merge (had one source, now has both)
            const hadPodbean = !!existingSermon.podbean_url;
            const hadYouTube = !!existingSermon.youtube_video_id;
            const nowHasPodbean = !!(updateData.podbean_url || existingSermon.podbean_url);
            const nowHasYouTube = !!(updateData.youtube_video_id || existingSermon.youtube_video_id);

            if ((hadPodbean && !hadYouTube && nowHasYouTube) || (hadYouTube && !hadPodbean && nowHasPodbean)) {
              results.merged++;
              console.log(`[${i + 1}/${matchedSermons.length}] 🔗 Merged: ${matched.title.substring(0, 60)}...`);
            } else {
              results.updated++;
              console.log(`[${i + 1}/${matchedSermons.length}] ✅ Updated: ${matched.title.substring(0, 60)}...`);
            }
          } else {
            results.skipped++;
          }
        } else {
          // CREATE: New sermon with merged data
          const { data: newSermon, error: insertError } = await supabase
            .from("sermons")
            .insert(sermonData)
            .select()
            .single();

          if (insertError) {
            throw new Error(`Insert failed: ${insertError.message}`);
          }

          // Add sermon sources for tracking
          if (newSermon) {
            try {
              if (matched.podbeanEpisode?.url) {
                await supabase.from("sermon_sources").insert({
                  sermon_id: newSermon.id,
                  source_type: "podbean",
                  source_url: matched.podbeanEpisode.url,
                  source_id: matched.podbeanEpisode.guid,
                });
              }
              if (matched.youtubeVideo?.videoId) {
                await supabase.from("sermon_sources").insert({
                  sermon_id: newSermon.id,
                  source_type: "youtube",
                  source_url: matched.youtubeVideo.url,
                  source_id: matched.youtubeVideo.videoId,
                });
              }
            } catch (sourceError) {
              // Non-critical
              console.warn(`⚠️  Failed to add sermon sources:`, sourceError);
            }
          }

          results.created++;
          console.log(`[${i + 1}/${matchedSermons.length}] ✨ Created: ${matched.title.substring(0, 60)}...`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.errors.push(`Sermon "${matched.title}": ${errorMsg}`);
        console.error(`[${i + 1}/${matchedSermons.length}] ❌ Error: ${errorMsg}`);
      }
    }

    // Handle unmatched Podbean episodes (Podbean-only sermons)
    console.log(`\n📥 Processing Podbean-only sermons...`);
    const matchedPodbeanGuids = new Set(
      matchedSermons
        .filter(m => m.podbeanEpisode)
        .map(m => m.podbeanEpisode!.guid)
    );

    let podbeanOnlyCount = 0;
    for (const episode of podbeanEpisodes) {
      if (matchedPodbeanGuids.has(episode.guid)) continue;

      // Check if already exists
      const existing = sermonsByPodbeanUrl.get(episode.url);
      if (existing) {
        continue; // Already processed
      }

      try {
        const sermonData = {
          title: episode.title,
          date: episode.date.toISOString(),
          description: episode.description || null,
          podbean_url: episode.url,
          audio_url: episode.audioUrl || null,
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

        if (newSermon) {
          try {
            await supabase.from("sermon_sources").insert({
              sermon_id: newSermon.id,
              source_type: "podbean",
              source_url: episode.url,
              source_id: episode.guid,
            });
          } catch (sourceError) {
            // Non-critical
          }
        }

        podbeanOnlyCount++;
        console.log(`   ✨ Created Podbean-only: ${episode.title.substring(0, 60)}...`);
      } catch (error) {
        console.error(`   ❌ Error creating Podbean-only sermon: ${error}`);
      }
    }

    // Handle unmatched YouTube videos (YouTube-only sermons)
    console.log(`\n📥 Processing YouTube-only sermons...`);
    const matchedYouTubeIds = new Set(
      matchedSermons
        .filter(m => m.youtubeVideo)
        .map(m => m.youtubeVideo!.videoId)
    );

    let youtubeOnlyCount = 0;
    for (const video of youtubeVideos) {
      if (matchedYouTubeIds.has(video.videoId)) continue;

      // Check if already exists
      const existing = sermonsByYouTubeId.get(video.videoId);
      if (existing) {
        continue; // Already processed
      }

      try {
        const sermonData = {
          title: video.title,
          date: video.publishedAt.toISOString(),
          description: video.description || null,
          youtube_url: video.url,
          youtube_video_id: video.videoId,
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

        if (newSermon) {
          try {
            await supabase.from("sermon_sources").insert({
              sermon_id: newSermon.id,
              source_type: "youtube",
              source_url: video.url,
              source_id: video.videoId,
            });
          } catch (sourceError) {
            // Non-critical
          }
        }

        youtubeOnlyCount++;
        console.log(`   ✨ Created YouTube-only: ${video.title.substring(0, 60)}...`);
      } catch (error) {
        console.error(`   ❌ Error creating YouTube-only sermon: ${error}`);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   📥 Podbean episodes: ${podbeanEpisodes.length}`);
    console.log(`   📥 YouTube videos: ${youtubeVideos.length}`);
    console.log(`   🔍 Matched sermons: ${matchedSermons.length}`);
    console.log(`   ✨ New sermons created: ${results.created}`);
    console.log(`   ✅ Sermons updated: ${results.updated}`);
    console.log(`   🔗 Sermons merged (both sources): ${results.merged}`);
    console.log(`   ⏭️  Sermons skipped: ${results.skipped}`);
    console.log(`   📻 Podbean-only created: ${podbeanOnlyCount}`);
    console.log(`   📺 YouTube-only created: ${youtubeOnlyCount}`);
    console.log(`   ❌ Errors: ${results.errors.length}`);

    if (results.errors.length > 0) {
      console.log(`\n❌ Errors:`);
      results.errors.forEach(err => console.log(`   - ${err}`));
    }

    console.log(`\n✅ Merge complete!`);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
