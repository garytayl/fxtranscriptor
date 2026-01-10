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

    // Test database connection first
    const { error: testError } = await supabase.from("sermons").select("id").limit(1);
    if (testError) {
      console.error("Database connection error:", testError);
      if (testError.message.includes("relation") || testError.message.includes("does not exist")) {
        return NextResponse.json(
          { 
            error: "Database tables not found. Please run the schema.sql file in your Supabase SQL Editor first.",
            details: testError.message
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { 
          error: "Database connection failed",
          details: testError.message
        },
        { status: 500 }
      );
    }

    // Get RSS URL and YouTube channel from env or use defaults
    // Try both Podbean RSS formats
    const podbeanRssUrl = process.env.PODBEAN_RSS_URL || "https://fxtalk.podbean.com/feed.xml";
    const youtubeChannel = process.env.YOUTUBE_CHANNEL_ID || "@fxchurch";

    // Fetch catalogs
    console.log("Fetching Podbean catalog from:", podbeanRssUrl);
    let podbeanEpisodes: any[] = [];
    try {
      podbeanEpisodes = await fetchPodbeanCatalog(podbeanRssUrl);
      console.log(`Fetched ${podbeanEpisodes.length} Podbean episodes`);
    } catch (podbeanError) {
      console.error("Error fetching Podbean catalog:", podbeanError);
      // Try alternative RSS URL
      const altRssUrl = "https://feed.podbean.com/fxtalk/feed.xml";
      try {
        console.log("Trying alternative RSS URL:", altRssUrl);
        podbeanEpisodes = await fetchPodbeanCatalog(altRssUrl);
        console.log(`Fetched ${podbeanEpisodes.length} Podbean episodes from alternative URL`);
      } catch (altError) {
        console.error("Alternative RSS URL also failed:", altError);
        // Continue with empty array - we'll still try YouTube
      }
    }

    console.log("Fetching YouTube catalog from:", youtubeChannel);
    let youtubeVideos: any[] = [];
    try {
      youtubeVideos = await fetchYouTubeCatalog(youtubeChannel);
      console.log(`Fetched ${youtubeVideos.length} YouTube videos`);
    } catch (youtubeError) {
      console.error("Error fetching YouTube catalog:", youtubeError);
      // Continue with empty array - we'll still store Podbean episodes
    }

    // Match sermons (deduplicate)
    console.log("Matching sermons...");
    const matchedSermons = matchSermons(podbeanEpisodes, youtubeVideos);
    console.log(`Matched ${matchedSermons.length} unique sermons`);

    if (matchedSermons.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No sermons found. Check Podbean RSS URL and YouTube channel.",
        summary: {
          podbeanEpisodes: podbeanEpisodes.length,
          youtubeVideos: youtubeVideos.length,
          matchedSermons: 0,
        },
      }, { status: 404 });
    }

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
          const { data: existingByPodbean, error: podbeanCheckError } = await supabase
            .from("sermons")
            .select("id")
            .eq("podbean_url", matched.podbeanEpisode.url)
            .maybeSingle();

          if (podbeanCheckError && !podbeanCheckError.message.includes("No rows")) {
            throw podbeanCheckError;
          }

          if (existingByPodbean) {
            existingSermonId = existingByPodbean.id;
          }
        }

        if (!existingSermonId && matched.youtubeVideo?.videoId) {
          const { data: existingByYouTube, error: youtubeCheckError } = await supabase
            .from("sermons")
            .select("id")
            .eq("youtube_video_id", matched.youtubeVideo.videoId)
            .maybeSingle();

          if (youtubeCheckError && !youtubeCheckError.message.includes("No rows")) {
            throw youtubeCheckError;
          }

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
          const { error: updateError } = await supabase
            .from("sermons")
            .update(sermonData)
            .eq("id", existingSermonId);

          if (updateError) {
            throw new Error(`Update failed: ${updateError.message}`);
          }
          results.updated++;
        } else {
          // Create new sermon
          const { data: newSermon, error: insertError } = await supabase
            .from("sermons")
            .insert(sermonData)
            .select()
            .single();

          if (insertError) {
            throw new Error(`Insert failed: ${insertError.message}`);
          }
          
          if (!newSermon) {
            throw new Error("Insert succeeded but no data returned");
          }
          
          existingSermonId = newSermon.id;
          results.created++;

          // Add sermon sources for deduplication tracking (non-blocking)
          if (matched.podbeanEpisode && existingSermonId) {
            try {
              await supabase.from("sermon_sources").insert({
                sermon_id: existingSermonId,
                source_type: "podbean",
                source_url: matched.podbeanEpisode.url,
                source_id: matched.podbeanEpisode.guid,
              });
            } catch (sourceError) {
              console.warn("Failed to add Podbean source (non-critical):", sourceError);
            }
          }

          if (matched.youtubeVideo && existingSermonId) {
            try {
              await supabase.from("sermon_sources").insert({
                sermon_id: existingSermonId,
                source_type: "youtube",
                source_url: matched.youtubeVideo.url,
                source_id: matched.youtubeVideo.videoId,
              });
            } catch (sourceError) {
              console.warn("Failed to add YouTube source (non-critical):", sourceError);
            }
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        const title = matched.title || "Untitled";
        results.errors.push(`"${title}": ${errorMsg}`);
        console.error(`Error storing sermon "${title}":`, error);
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
