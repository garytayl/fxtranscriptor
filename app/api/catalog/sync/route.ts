/**
 * API Route: Sync Catalog
 * Fetches episodes from Podbean RSS and YouTube channel, matches them, and stores in Supabase
 * 
 * Call this periodically (e.g., via Vercel Cron) or manually via admin panel
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchPodbeanCatalog } from "@/lib/fetchPodbeanCatalog";
import { fetchYouTubeCatalog } from "@/lib/fetchYouTubeCatalog";
import { matchSermons } from "@/lib/matchSermons";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY" },
        { status: 500 }
      );
    }

    // Get RSS URL and YouTube channel from env or use defaults
    const podbeanRssUrl = process.env.PODBEAN_RSS_URL || "https://feed.podbean.com/fxtalk/feed.xml";
    const youtubeChannel = process.env.YOUTUBE_CHANNEL_ID || "@fxchurch";

    // Fetch catalogs
    console.log("Fetching Podbean catalog...");
    const podbeanEpisodes = await fetchPodbeanCatalog(podbeanRssUrl);

    console.log("Fetching YouTube catalog...");
    const youtubeVideos = await fetchYouTubeCatalog(youtubeChannel);

    // Match sermons (deduplicate)
    console.log("Matching sermons...");
    const matchedSermons = matchSermons(podbeanEpisodes, youtubeVideos);

    // Store in Supabase
    console.log(`Storing ${matchedSermons.length} sermons in database...`);
    
    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[],
    };

    for (const matched of matchedSermons) {
      try {
        // Check if sermon already exists (by Podbean URL or YouTube video ID)
        let existingSermonId: string | null = null;

        if (matched.podbeanEpisode?.url) {
          const { data: existingByPodbean } = await supabase
            .from("sermons")
            .select("id")
            .eq("podbean_url", matched.podbeanEpisode.url)
            .single();

          if (existingByPodbean) {
            existingSermonId = existingByPodbean.id;
          }
        }

        if (!existingSermonId && matched.youtubeVideo?.videoId) {
          const { data: existingByYouTube } = await supabase
            .from("sermons")
            .select("id")
            .eq("youtube_video_id", matched.youtubeVideo.videoId)
            .single();

          if (existingByYouTube) {
            existingSermonId = existingByYouTube.id;
          }
        }

        // Prepare sermon data
        const sermonData = {
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

        if (existingSermonId) {
          // Update existing sermon
          const { error } = await supabase
            .from("sermons")
            .update(sermonData)
            .eq("id", existingSermonId);

          if (error) throw error;
          results.updated++;
        } else {
          // Create new sermon
          const { data: newSermon, error } = await supabase
            .from("sermons")
            .insert(sermonData)
            .select()
            .single();

          if (error) throw error;
          existingSermonId = newSermon.id;
          results.created++;

          // Add sermon sources for deduplication tracking
          if (matched.podbeanEpisode) {
            await supabase.from("sermon_sources").insert({
              sermon_id: existingSermonId,
              source_type: "podbean",
              source_url: matched.podbeanEpisode.url,
              source_id: matched.podbeanEpisode.guid,
            });
          }

          if (matched.youtubeVideo) {
            await supabase.from("sermon_sources").insert({
              sermon_id: existingSermonId,
              source_type: "youtube",
              source_url: matched.youtubeVideo.url,
              source_id: matched.youtubeVideo.videoId,
            });
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        results.errors.push(`Error processing "${matched.title}": ${errorMsg}`);
        console.error("Error storing sermon:", error);
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        podbeanEpisodes: podbeanEpisodes.length,
        youtubeVideos: youtubeVideos.length,
        matchedSermons: matchedSermons.length,
        ...results,
      },
      errors: results.errors,
    });
  } catch (error) {
    console.error("Catalog sync error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
