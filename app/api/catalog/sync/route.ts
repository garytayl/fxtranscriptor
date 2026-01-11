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
      
      // Check for Supabase connection timeout (522 error from Cloudflare)
      const errorMessage = testError.message || String(testError);
      const errorString = String(testError);
      
      if (errorString.includes("522") || 
          errorString.includes("Connection timed out") || 
          errorMessage.includes("522") ||
          errorMessage.includes("timed out") ||
          errorString.includes("mfzrunlgkpbtiwuzmivq.supabase.co") ||
          errorString.includes("<!DOCTYPE html>")) {
        return NextResponse.json(
          { 
            error: "Supabase database connection timed out (Error 522).\n\n" +
                   "Your Supabase project is paused or not responding. To fix:\n\n" +
                   "1. Go to https://supabase.com/dashboard\n" +
                   "2. Open your project (mfzrunlgkpbtiwuzmivq)\n" +
                   "3. If you see 'Paused' or 'Resume' button, click it\n" +
                   "4. Wait 1-2 minutes for the database to fully wake up\n" +
                   "5. Try again\n\n" +
                   "Free tier projects pause after ~1 week of inactivity.",
            details: "Cloudflare Error 522: Connection timed out"
          },
          { status: 503 } // Service Unavailable
        );
      }
      
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
    console.log("[Sync] Matching sermons...");
    const matchedSermons = matchSermons(podbeanEpisodes, youtubeVideos);
    
    // Calculate match statistics
    const matchedCount = matchedSermons.filter(m => m.podbeanEpisode && m.youtubeVideo).length;
    const podbeanOnlyCount = matchedSermons.filter(m => m.podbeanEpisode && !m.youtubeVideo).length;
    const youtubeOnlyCount = matchedSermons.filter(m => m.youtubeVideo && !m.podbeanEpisode).length;
    const withAudioUrlCount = matchedSermons.filter(m => m.podbeanEpisode?.audioUrl).length;
    
    console.log(`[Sync] Matching complete: ${matchedSermons.length} total sermons`);
    console.log(`[Sync] Statistics: ${matchedCount} matched (both sources), ${podbeanOnlyCount} Podbean-only, ${youtubeOnlyCount} YouTube-only`);
    console.log(`[Sync] Audio URLs available: ${withAudioUrlCount}/${matchedSermons.length} (${(withAudioUrlCount / matchedSermons.length * 100).toFixed(1)}%)`);
    
    // Log Podbean episodes with/without audio URLs for debugging
    const podbeanWithAudio = podbeanEpisodes.filter(ep => ep.audioUrl).length;
    console.log(`[Sync] Podbean RSS: ${podbeanEpisodes.length} episodes, ${podbeanWithAudio} have audio_url in RSS feed`);
    if (podbeanWithAudio < podbeanEpisodes.length) {
      console.log(`[Sync] ⚠️ ${podbeanEpisodes.length - podbeanWithAudio} Podbean episodes missing audio_url - check RSS feed format`);
    }

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

    // Reverse lookup: Find existing YouTube-only sermons and try to match with Podbean episodes
    console.log(`[Sync] Performing reverse lookup for existing YouTube-only sermons...`);
    let reverseMatchedCount = 0;
    try {
      const { data: existingYouTubeOnlySermons, error: fetchError } = await supabase
        .from("sermons")
        .select("id, title, youtube_url, youtube_video_id, date")
        .is("podbean_url", null)
        .not("youtube_url", "is", null);
      
      if (!fetchError && existingYouTubeOnlySermons && existingYouTubeOnlySermons.length > 0) {
        console.log(`[Sync] Found ${existingYouTubeOnlySermons.length} existing YouTube-only sermons, attempting to match...`);
        
        // Helper functions for reverse lookup (simplified versions)
        const normalizeTitleForMatch = (title: string): string => {
          return title.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
        };
        
        const calculateSimpleTitleSimilarity = (title1: string, title2: string): number => {
          const words1 = new Set(title1.split(' ').filter(w => w.length > 2));
          const words2 = new Set(title2.split(' ').filter(w => w.length > 2));
          const intersection = new Set([...words1].filter(x => words2.has(x)));
          const union = new Set([...words1, ...words2]);
          return union.size === 0 ? 0 : intersection.size / union.size;
        };
        
        const calculateSimpleDateProximity = (date1: Date, date2: Date): number => {
          const diffMs = Math.abs(date1.getTime() - date2.getTime());
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          if (diffDays <= 1) return 1.0;
          if (diffDays <= 7) return 1.0 - (diffDays - 1) / 6;
          return 0;
        };
        
        for (const existingSermon of existingYouTubeOnlySermons) {
          // DATE-FIRST MATCHING: Find closest Podbean episode within ±3 days (deterministic)
          const sermonDate = existingSermon.date ? new Date(existingSermon.date) : null;
          const DATE_WINDOW_DAYS = 3;
          
          let bestMatch: typeof podbeanEpisodes[0] | undefined;
          let bestDaysDiff = Infinity;
          let bestTitleSimilarity = 0;
          
          if (sermonDate) {
            // Find all candidates within date window, sorted by date proximity then title similarity
            const candidates = podbeanEpisodes
              .filter(pb => pb.date) // Only episodes with dates
              .map(pb => {
                const pbDate = pb.date!; // Safe because we filtered above
                const daysDiff = Math.abs((sermonDate.getTime() - pbDate.getTime()) / (1000 * 60 * 60 * 24));
                const normalizedExisting = normalizeTitleForMatch(existingSermon.title || '');
                const normalizedPodbean = normalizeTitleForMatch(pb.title);
                const titleSimilarity = calculateSimpleTitleSimilarity(normalizedExisting, normalizedPodbean);
                
                return { episode: pb, daysDiff, titleSimilarity };
              })
              .filter(c => c.daysDiff <= DATE_WINDOW_DAYS)
              .sort((a, b) => {
                // Sort by: 1) closest date, 2) highest title similarity
                if (Math.abs(a.daysDiff - b.daysDiff) > 0.1) {
                  return a.daysDiff - b.daysDiff;
                }
                return b.titleSimilarity - a.titleSimilarity;
              });
            
            if (candidates.length > 0) {
              bestMatch = candidates[0].episode;
              bestDaysDiff = candidates[0].daysDiff;
              bestTitleSimilarity = candidates[0].titleSimilarity;
              console.log(`[Sync] ✅ Date-first match: "${existingSermon.title?.substring(0, 50)}..." ↔ "${bestMatch.title.substring(0, 50)}..." (${bestDaysDiff.toFixed(1)} days apart, title similarity: ${(bestTitleSimilarity * 100).toFixed(0)}%, ${candidates.length} candidate(s))`);
            } else {
              // Log available dates for debugging
              const availableDates = podbeanEpisodes
                .filter(pb => pb.date)
                .map(pb => ({ title: pb.title.substring(0, 40), date: pb.date!.toISOString().split('T')[0] }))
                .slice(0, 5); // Show first 5 for debugging
              console.log(`[Sync] ❌ No Podbean episode found within ±${DATE_WINDOW_DAYS} days of "${existingSermon.title?.substring(0, 50)}..." (sermon date: ${sermonDate.toISOString().split('T')[0]})`);
              if (availableDates.length > 0) {
                console.log(`[Sync] Available Podbean dates: ${availableDates.map(d => `${d.date} (${d.title}...)`).join(', ')}`);
              }
            }
          }
          
          // Fallback to title-based matching if no date match
          if (!bestMatch) {
            bestMatch = podbeanEpisodes.find(pb => {
              const normalizedExisting = normalizeTitleForMatch(existingSermon.title || '');
              const normalizedPodbean = normalizeTitleForMatch(pb.title);
              const titleSimilarity = calculateSimpleTitleSimilarity(normalizedExisting, normalizedPodbean);
              
              return titleSimilarity >= 0.6;
            });
            
            if (bestMatch) {
              const normalizedExisting = normalizeTitleForMatch(existingSermon.title || '');
              const normalizedPodbean = normalizeTitleForMatch(bestMatch.title);
              bestTitleSimilarity = calculateSimpleTitleSimilarity(normalizedExisting, normalizedPodbean);
              console.log(`[Sync] Title-based fallback match: "${existingSermon.title?.substring(0, 50)}..." ↔ "${bestMatch.title.substring(0, 50)}..." (title similarity: ${(bestTitleSimilarity * 100).toFixed(0)}%)`);
            }
          }
          
          if (bestMatch) {
            // Update existing sermon with Podbean data
            const { error: updateError } = await supabase
              .from("sermons")
              .update({
                podbean_url: bestMatch.url,
                audio_url: bestMatch.audioUrl || null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingSermon.id);
            
            if (!updateError) {
              reverseMatchedCount++;
              console.log(`[Sync] ✅ Reverse matched existing YouTube-only sermon: "${existingSermon.title?.substring(0, 50)}..." with Podbean episode`);
            }
          }
        }
        
        if (reverseMatchedCount > 0) {
          console.log(`[Sync] Reverse lookup: ${reverseMatchedCount} existing YouTube-only sermons matched with Podbean episodes`);
        }
      }
    } catch (reverseLookupError) {
      console.warn(`[Sync] Reverse lookup failed (non-critical):`, reverseLookupError);
    }

    // Store in Supabase
    console.log(`[Sync] Storing ${matchedSermons.length} sermons in database...`);
    
    const results = {
      created: 0,
      updated: 0,
      matched: matchedCount,
      podbeanOnly: podbeanOnlyCount,
      youtubeOnly: youtubeOnlyCount,
      withAudioUrl: withAudioUrlCount,
      reverseMatched: reverseMatchedCount,
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
          // Preserve audio_url if it already exists and new match doesn't have one
          const { data: existingSermon, error: fetchExistingError } = await supabase
            .from("sermons")
            .select("audio_url, podbean_url, youtube_url")
            .eq("id", existingSermonId)
            .maybeSingle();
          
          if (fetchExistingError) {
            throw new Error(`Failed to fetch existing sermon: ${fetchExistingError.message}`);
          }
          
          // If existing sermon has audio_url but new match doesn't, preserve it
          if (existingSermon?.audio_url && !sermonData.audio_url) {
            sermonData.audio_url = existingSermon.audio_url;
            console.log(`[Sync] Preserved existing audio_url for sermon: ${matched.title.substring(0, 50)}...`);
          }
          
          // If existing sermon has YouTube URL but new match has Podbean, try to merge
          if (existingSermon?.youtube_url && !sermonData.youtube_url && matched.youtubeVideo?.url) {
            sermonData.youtube_url = existingSermon.youtube_url;
            sermonData.youtube_video_id = existingSermon.youtube_url.match(/[?&]v=([^&]+)/)?.[1] || null;
            console.log(`[Sync] Merging YouTube URL from existing sermon: ${matched.title.substring(0, 50)}...`);
          }
          
          // If existing sermon has Podbean URL but new match has YouTube, try to merge
          if (existingSermon?.podbean_url && !sermonData.podbean_url && matched.podbeanEpisode?.url) {
            sermonData.podbean_url = existingSermon.podbean_url;
            if (matched.podbeanEpisode?.audioUrl) {
              sermonData.audio_url = matched.podbeanEpisode.audioUrl;
            }
            console.log(`[Sync] Merging Podbean URL from existing sermon: ${matched.title.substring(0, 50)}...`);
          }
          
          const { error: updateError } = await supabase
            .from("sermons")
            .update(sermonData)
            .eq("id", existingSermonId);

          if (updateError) {
            throw new Error(`Update failed: ${updateError.message}`);
          }
          results.updated++;
          console.log(`[Sync] Updated existing sermon: ${matched.title.substring(0, 50)}...`);
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
          console.log(`[Sync] Created new sermon: ${matched.title.substring(0, 50)}... (has audio_url: ${!!sermonData.audio_url})`);
          
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
