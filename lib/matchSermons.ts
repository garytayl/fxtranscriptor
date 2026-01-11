/**
 * Matches sermons across different sources (Podbean, YouTube)
 * to prevent duplicates in the catalog
 * 
 * Uses multiple strategies:
 * - Title similarity (Jaccard + substring matching)
 * - Date proximity (within 7 days)
 * - Episode number extraction and matching
 * - Description similarity
 * - Bidirectional matching (Podbean→YouTube and YouTube→Podbean)
 */

import { PodbeanEpisode } from './fetchPodbeanCatalog';
import { YouTubeVideo } from './fetchYouTubeCatalog';

export interface MatchedSermon {
  title: string;
  date: Date | null;
  description: string;
  podbeanEpisode?: PodbeanEpisode;
  youtubeVideo?: YouTubeVideo;
  confidence: number; // 0-1, how confident we are this is a match
  matchReason?: string; // Debugging: why this matched
}

interface MatchResult {
  video: YouTubeVideo;
  episode: PodbeanEpisode; // Always present in a valid match
  confidence: number;
  reason: string;
}

/**
 * Enhanced matching algorithm with multiple strategies and bidirectional matching
 */
export function matchSermons(
  podbeanEpisodes: PodbeanEpisode[],
  youtubeVideos: YouTubeVideo[]
): MatchedSermon[] {
  console.log(`[MatchSermons] Starting matching: ${podbeanEpisodes.length} Podbean episodes, ${youtubeVideos.length} YouTube videos`);
  
  const matches: MatchedSermon[] = [];
  const matchedPodbeanGuids = new Set<string>();
  const matchedYouTubeIds = new Set<string>();
  
  let matchCount = 0;

  // Pass 1: Match Podbean → YouTube (bidirectional with enhanced strategies)
  for (const podbeanEp of podbeanEpisodes) {
    if (matchedPodbeanGuids.has(podbeanEp.guid)) continue;
    
    const bestMatch = findBestMatch(podbeanEp, youtubeVideos, matchedYouTubeIds, 'podbean-to-youtube');
    
    if (bestMatch && bestMatch.confidence >= 0.6) {
      matches.push({
        title: podbeanEp.title,
        date: podbeanEp.date,
        description: podbeanEp.description || bestMatch.video.description,
        podbeanEpisode: podbeanEp,
        youtubeVideo: bestMatch.video,
        confidence: bestMatch.confidence,
        matchReason: bestMatch.reason,
      });
      
      matchedPodbeanGuids.add(podbeanEp.guid);
      matchedYouTubeIds.add(bestMatch.video.videoId);
      matchCount++;
      console.log(`[MatchSermons] ✅ Matched: "${podbeanEp.title.substring(0, 50)}..." ↔ "${bestMatch.video.title.substring(0, 50)}..." (confidence: ${bestMatch.confidence.toFixed(2)}, reason: ${bestMatch.reason})`);
    }
  }

  // Pass 2: Reverse matching - Match unmatched YouTube videos → Podbean
  for (const ytVideo of youtubeVideos) {
    if (matchedYouTubeIds.has(ytVideo.videoId)) continue;
    if (!isLikelySermon(ytVideo.title)) continue; // Skip non-sermon videos
    
    const bestMatch = findBestPodbeanMatch(ytVideo, podbeanEpisodes, matchedPodbeanGuids);
    
    if (bestMatch && bestMatch.confidence >= 0.6) {
      matches.push({
        title: ytVideo.title,
        date: ytVideo.publishedAt || bestMatch.episode.date,
        description: ytVideo.description || bestMatch.episode.description,
        podbeanEpisode: bestMatch.episode,
        youtubeVideo: ytVideo,
        confidence: bestMatch.confidence,
        matchReason: bestMatch.reason,
      });
      
      matchedPodbeanGuids.add(bestMatch.episode.guid);
      matchedYouTubeIds.add(ytVideo.videoId);
      matchCount++;
      console.log(`[MatchSermons] ✅ Reverse matched: "${ytVideo.title.substring(0, 50)}..." ↔ "${bestMatch.episode.title.substring(0, 50)}..." (confidence: ${bestMatch.confidence.toFixed(2)}, reason: ${bestMatch.reason})`);
    }
  }

  // Pass 3: Add unmatched Podbean episodes
  let unmatchedPodbean = 0;
  for (const podbeanEp of podbeanEpisodes) {
    if (!matchedPodbeanGuids.has(podbeanEp.guid)) {
      matches.push({
        title: podbeanEp.title,
        date: podbeanEp.date,
        description: podbeanEp.description,
        podbeanEpisode: podbeanEp,
        confidence: 1.0,
        matchReason: 'Podbean-only (no YouTube match)',
      });
      unmatchedPodbean++;
    }
  }

  // Pass 4: Add unmatched YouTube videos (sermons not on Podbean yet)
  let unmatchedYouTube = 0;
  for (const ytVideo of youtubeVideos) {
    if (!matchedYouTubeIds.has(ytVideo.videoId) && isLikelySermon(ytVideo.title)) {
      matches.push({
        title: ytVideo.title,
        date: ytVideo.publishedAt,
        description: ytVideo.description,
        youtubeVideo: ytVideo,
        confidence: 1.0,
        matchReason: 'YouTube-only (no Podbean match)',
      });
      unmatchedYouTube++;
    }
  }

  console.log(`[MatchSermons] Matching complete: ${matchCount} matched, ${unmatchedPodbean} Podbean-only, ${unmatchedYouTube} YouTube-only`);

  // Sort by date (newest first)
  return matches.sort((a, b) => {
    const dateA = a.date?.getTime() || 0;
    const dateB = b.date?.getTime() || 0;
    return dateB - dateA;
  });
}

/**
 * Find best YouTube match for a Podbean episode using multiple strategies
 */
function findBestMatch(
  podbeanEp: PodbeanEpisode,
  youtubeVideos: YouTubeVideo[],
  excludeIds: Set<string>,
  direction: string
): MatchResult | null {
  let bestMatch: MatchResult | null = null;
  
  const podbeanEpisodeNum = extractEpisodeNumber(podbeanEp.title);
  const normalizedPodbeanTitle = normalizeTitle(podbeanEp.title);

  for (const ytVideo of youtubeVideos) {
    if (excludeIds.has(ytVideo.videoId)) continue;

    const youtubeEpisodeNum = extractEpisodeNumber(ytVideo.title);
    const normalizedYouTubeTitle = normalizeTitle(ytVideo.title);
    
    // Calculate weighted confidence using multiple strategies
    const matchResult = calculateWeightedConfidence(
      podbeanEp,
      ytVideo,
      normalizedPodbeanTitle,
      normalizedYouTubeTitle,
      podbeanEpisodeNum,
      youtubeEpisodeNum
    );

    if (matchResult.confidence >= 0.6 && (!bestMatch || matchResult.confidence > bestMatch.confidence)) {
      bestMatch = {
        video: ytVideo,
        episode: podbeanEp, // Always include the Podbean episode for Podbean→YouTube matches
        confidence: matchResult.confidence,
        reason: matchResult.reason,
      };
    }
  }

  return bestMatch;
}

/**
 * Reverse matching: Find best Podbean match for a YouTube video
 * NEW: Date-first matching (deterministic)
 */
function findBestPodbeanMatch(
  ytVideo: YouTubeVideo,
  podbeanEpisodes: PodbeanEpisode[],
  excludeGuids: Set<string>
): MatchResult | null {
  // DATE-FIRST MATCHING: Find closest Podbean episode within ±3 days
  const youtubeDate = ytVideo.publishedAt || null;
  const DATE_WINDOW_DAYS = 3; // ±3 days window
  
  if (!youtubeDate) {
    console.log(`[MatchSermons] YouTube video "${ytVideo.title.substring(0, 50)}..." has no published date, falling back to title-based matching`);
    // Fall back to title-based matching if no date
    return findBestPodbeanMatchByTitle(ytVideo, podbeanEpisodes, excludeGuids);
  }
  
  // Find all Podbean episodes within date window
  const candidates: Array<{ episode: PodbeanEpisode; daysDiff: number; titleSimilarity: number }> = [];
  
  for (const podbeanEp of podbeanEpisodes) {
    if (excludeGuids.has(podbeanEp.guid)) continue;
    if (!podbeanEp.date) continue;
    
    const daysDiff = Math.abs((youtubeDate.getTime() - podbeanEp.date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= DATE_WINDOW_DAYS) {
      // Calculate title similarity as tie-breaker
      const normalizedPodbeanTitle = normalizeTitle(podbeanEp.title);
      const normalizedYouTubeTitle = normalizeTitle(ytVideo.title);
      const titleSimilarity = calculateTitleSimilarity(normalizedPodbeanTitle, normalizedYouTubeTitle);
      
      candidates.push({
        episode: podbeanEp,
        daysDiff,
        titleSimilarity,
      });
    }
  }
  
  // Sort by: 1) closest date, 2) highest title similarity
  candidates.sort((a, b) => {
    if (Math.abs(a.daysDiff - b.daysDiff) > 0.1) {
      return a.daysDiff - b.daysDiff; // Closer date wins
    }
    return b.titleSimilarity - a.titleSimilarity; // Better title match wins tie
  });
  
  if (candidates.length > 0) {
    const best = candidates[0];
    const confidence = 0.9 - (best.daysDiff / DATE_WINDOW_DAYS) * 0.3; // 0.9 to 0.6 based on date proximity
    const reason = `date match: ${best.daysDiff.toFixed(1)} days apart${best.titleSimilarity > 0.5 ? `, title similarity: ${(best.titleSimilarity * 100).toFixed(0)}%` : ''}`;
    
    console.log(`[MatchSermons] ✅ Date-first match: "${ytVideo.title.substring(0, 50)}..." ↔ "${best.episode.title.substring(0, 50)}..." (${best.daysDiff.toFixed(1)} days apart, ${candidates.length} candidate(s))`);
    
    return {
      video: ytVideo,
      episode: best.episode,
      confidence: Math.max(0.6, confidence), // Ensure at least 0.6 confidence
      reason,
    };
  }
  
  // No date match found - log why
  console.log(`[MatchSermons] ❌ No Podbean episode found within ±${DATE_WINDOW_DAYS} days of YouTube video "${ytVideo.title.substring(0, 50)}..." (date: ${youtubeDate.toISOString().split('T')[0]})`);
  console.log(`[MatchSermons] Available Podbean dates: ${podbeanEpisodes.filter(ep => ep.date && !excludeGuids.has(ep.guid)).map(ep => ep.date?.toISOString().split('T')[0]).join(', ')}`);
  
  // Fall back to title-based matching if no date match
  return findBestPodbeanMatchByTitle(ytVideo, podbeanEpisodes, excludeGuids);
}

/**
 * Fallback: Title-based matching for videos without dates or when date matching fails
 */
function findBestPodbeanMatchByTitle(
  ytVideo: YouTubeVideo,
  podbeanEpisodes: PodbeanEpisode[],
  excludeGuids: Set<string>
): MatchResult | null {
  let bestMatch: MatchResult | null = null;
  
  const youtubeEpisodeNum = extractEpisodeNumber(ytVideo.title);
  const normalizedYouTubeTitle = normalizeTitle(ytVideo.title);

  for (const podbeanEp of podbeanEpisodes) {
    if (excludeGuids.has(podbeanEp.guid)) continue;

    const podbeanEpisodeNum = extractEpisodeNumber(podbeanEp.title);
    const normalizedPodbeanTitle = normalizeTitle(podbeanEp.title);
    
    // Calculate weighted confidence using multiple strategies
    const matchResult = calculateWeightedConfidence(
      podbeanEp,
      ytVideo,
      normalizedPodbeanTitle,
      normalizedYouTubeTitle,
      podbeanEpisodeNum,
      youtubeEpisodeNum
    );

    if (matchResult.confidence >= 0.6 && (!bestMatch || matchResult.confidence > bestMatch.confidence)) {
      bestMatch = {
        video: ytVideo,
        episode: podbeanEp,
        confidence: matchResult.confidence,
        reason: `title-based: ${matchResult.reason}`,
      };
    }
  }

  return bestMatch;
}

/**
 * Calculate weighted confidence using multiple matching strategies
 */
function calculateWeightedConfidence(
  podbeanEp: PodbeanEpisode,
  ytVideo: YouTubeVideo,
  normalizedPodbeanTitle: string,
  normalizedYouTubeTitle: string,
  podbeanEpisodeNum: string | null,
  youtubeEpisodeNum: string | null
): { confidence: number; reason: string } {
  // Strategy 1: Title similarity (40% weight)
  const titleSimilarity = calculateTitleSimilarity(normalizedPodbeanTitle, normalizedYouTubeTitle);
  
  // Strategy 2: Date proximity (50% weight if within 3 days - PRIMARY MATCHER)
  const dateProximity = calculateDateProximity(podbeanEp.date, ytVideo.publishedAt, 3); // Use 3-day window
  
  // Strategy 3: Episode number match (15% weight if both have episode numbers)
  let episodeMatch = 0;
  let episodeMatchReason = '';
  if (podbeanEpisodeNum && youtubeEpisodeNum) {
    if (podbeanEpisodeNum === youtubeEpisodeNum) {
      episodeMatch = 1.0;
      episodeMatchReason = 'episode number match';
    } else {
      episodeMatchReason = 'episode numbers differ';
    }
  } else {
    episodeMatchReason = 'no episode numbers';
  }
  
  // Strategy 4: Description similarity (5% weight if titles don't match well)
  let descriptionSimilarity = 0;
  if (titleSimilarity < 0.7 && podbeanEp.description && ytVideo.description) {
    descriptionSimilarity = calculateDescriptionSimilarity(podbeanEp.description, ytVideo.description);
  }
  
  // NEW WEIGHTS: Date is primary (50%), title is secondary (30%)
  let totalConfidence = dateProximity * 0.5; // Date is now PRIMARY
  totalConfidence += titleSimilarity * 0.3;  // Title is tie-breaker
  totalConfidence += episodeMatch * 0.15;
  totalConfidence += descriptionSimilarity * 0.05;
  
  // Build reason string
  const reasons: string[] = [];
  if (titleSimilarity > 0.7) reasons.push(`title similarity: ${(titleSimilarity * 100).toFixed(0)}%`);
  if (dateProximity > 0) reasons.push(`date proximity: ${(dateProximity * 100).toFixed(0)}%`);
  if (episodeMatch > 0) reasons.push(episodeMatchReason);
  if (descriptionSimilarity > 0.5) reasons.push(`description similarity: ${(descriptionSimilarity * 100).toFixed(0)}%`);
  
  const reason = reasons.length > 0 ? reasons.join(', ') : `low confidence: title=${(titleSimilarity * 100).toFixed(0)}%, date=${(dateProximity * 100).toFixed(0)}%`;
  
  return {
    confidence: Math.min(1.0, totalConfidence),
    reason,
  };
}

/**
 * Improved title similarity calculation with Jaccard + substring matching
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  // Remove common prefixes/suffixes for better matching
  const cleanTitle1 = removeCommonPrefixes(title1);
  const cleanTitle2 = removeCommonPrefixes(title2);
  
  // Word-based Jaccard similarity (filter out short words)
  const words1 = new Set(cleanTitle1.split(' ').filter(w => w.length > 2));
  const words2 = new Set(cleanTitle2.split(' ').filter(w => w.length > 2));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;
  
  const jaccardSimilarity = intersection.size / union.size;

  // Substring bonus (handles cases like "Sermon: Title" vs "Title")
  const contains = cleanTitle1.includes(cleanTitle2) || cleanTitle2.includes(cleanTitle1);
  const substringBonus = contains ? 0.3 : 0;

  return Math.min(1.0, jaccardSimilarity + substringBonus);
}

/**
 * Calculate date proximity score (1.0 if same day, decreasing over window)
 * @param date1 First date
 * @param date2 Second date  
 * @param windowDays Window in days (default: 7, but we use 3 for stricter matching)
 */
function calculateDateProximity(date1: Date | null, date2: Date | null, windowDays: number = 7): number {
  if (!date1 || !date2) return 0;
  
  const diffMs = Math.abs(date1.getTime() - date2.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
  // Same day = 1.0, within window = decreasing score, beyond window = 0
  if (diffDays <= 1) return 1.0;
  if (diffDays <= windowDays) {
    return 1.0 - (diffDays - 1) / (windowDays - 1); // Linear decrease from 1.0 to 0 over (windowDays-1) days
  }
  return 0;
}

/**
 * Extract episode number from title (e.g., "#25-0427", "Episode 25", "Sermon 25-0427")
 */
function extractEpisodeNumber(title: string): string | null {
  // Pattern 1: #25-0427 or #25-0427
  const pattern1 = /#?\s*(\d{1,3}-\d{4})/i;
  const match1 = title.match(pattern1);
  if (match1 && match1[1]) return match1[1];
  
  // Pattern 2: Episode 25 or Ep 25
  const pattern2 = /(?:episode|ep|sermon)\s*(\d{1,3})/i;
  const match2 = title.match(pattern2);
  if (match2 && match2[1]) return match2[1];
  
  // Pattern 3: 25-0427 (standalone)
  const pattern3 = /\b(\d{1,3}-\d{4})\b/;
  const match3 = title.match(pattern3);
  if (match3 && match3[1]) return match3[1];
  
  return null;
}

/**
 * Calculate description similarity (simplified version for performance)
 */
function calculateDescriptionSimilarity(desc1: string, desc2: string): number {
  if (!desc1 || !desc2) return 0;
  
  const normalized1 = normalizeTitle(desc1.substring(0, 200)); // First 200 chars for performance
  const normalized2 = normalizeTitle(desc2.substring(0, 200));
  
  return calculateTitleSimilarity(normalized1, normalized2);
}

/**
 * Remove common prefixes/suffixes from titles for better matching
 */
function removeCommonPrefixes(title: string): string {
  return title
    .replace(/^(sermon|message|teaching|preaching|episode|ep)[:\s]+/i, '')
    .replace(/\s*(sermon|message|teaching|preaching|episode)$/i, '')
    .trim();
}

/**
 * Normalize title for comparison (remove punctuation, lowercase, etc.)
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

function isLikelySermon(title: string): boolean {
  const lowerTitle = title.toLowerCase();
  const sermonKeywords = ['sermon', 'message', 'preaching', 'teaching', '25-', 'fx', 'fxchurch'];
  
  return sermonKeywords.some(keyword => lowerTitle.includes(keyword));
}
