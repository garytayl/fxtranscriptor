/**
 * Matches sermons across different sources (Podbean, YouTube)
 * to prevent duplicates in the catalog
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
}

/**
 * Simple title-based matching
 * Compares titles and extracts episode numbers/dates
 */
export function matchSermons(
  podbeanEpisodes: PodbeanEpisode[],
  youtubeVideos: YouTubeVideo[]
): MatchedSermon[] {
  const matches: MatchedSermon[] = [];
  const matchedPodbeanGuids = new Set<string>();
  const matchedYouTubeIds = new Set<string>();

  // First pass: Try to match by exact or similar title
  for (const podbeanEp of podbeanEpisodes) {
    const bestMatch = findBestYouTubeMatch(podbeanEp, youtubeVideos, matchedYouTubeIds);
    
    if (bestMatch && bestMatch.confidence > 0.7) {
      matches.push({
        title: podbeanEp.title,
        date: podbeanEp.date,
        description: podbeanEp.description || bestMatch.video.description,
        podbeanEpisode: podbeanEp,
        youtubeVideo: bestMatch.video,
        confidence: bestMatch.confidence,
      });
      
      matchedPodbeanGuids.add(podbeanEp.guid);
      matchedYouTubeIds.add(bestMatch.video.videoId);
    }
  }

  // Add unmatched Podbean episodes
  for (const podbeanEp of podbeanEpisodes) {
    if (!matchedPodbeanGuids.has(podbeanEp.guid)) {
      matches.push({
        title: podbeanEp.title,
        date: podbeanEp.date,
        description: podbeanEp.description,
        podbeanEpisode: podbeanEp,
        confidence: 1.0,
      });
    }
  }

  // Add unmatched YouTube videos (likely sermons that aren't on Podbean yet)
  for (const ytVideo of youtubeVideos) {
    if (!matchedYouTubeIds.has(ytVideo.videoId)) {
      // Only include if it looks like a sermon (heuristic: has common sermon keywords)
      if (isLikelySermon(ytVideo.title)) {
        matches.push({
          title: ytVideo.title,
          date: ytVideo.publishedAt,
          description: ytVideo.description,
          youtubeVideo: ytVideo,
          confidence: 1.0,
        });
      }
    }
  }

  // Sort by date (newest first)
  return matches.sort((a, b) => {
    const dateA = a.date?.getTime() || 0;
    const dateB = b.date?.getTime() || 0;
    return dateB - dateA;
  });
}

function findBestYouTubeMatch(
  podbeanEp: PodbeanEpisode,
  youtubeVideos: YouTubeVideo[],
  excludeIds: Set<string>
): { video: YouTubeVideo; confidence: number } | null {
  let bestMatch: { video: YouTubeVideo; confidence: number } | null = null;
  
  const normalizedPodbeanTitle = normalizeTitle(podbeanEp.title);

  for (const ytVideo of youtubeVideos) {
    if (excludeIds.has(ytVideo.videoId)) continue;

    const normalizedYouTubeTitle = normalizeTitle(ytVideo.title);
    const confidence = calculateSimilarity(normalizedPodbeanTitle, normalizedYouTubeTitle);

    if (!bestMatch || confidence > bestMatch.confidence) {
      bestMatch = { video: ytVideo, confidence };
    }
  }

  return bestMatch && bestMatch.confidence > 0.6 ? bestMatch : null;
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

function calculateSimilarity(title1: string, title2: string): number {
  // Simple word overlap similarity
  const words1 = new Set(title1.split(' ').filter(w => w.length > 2));
  const words2 = new Set(title2.split(' ').filter(w => w.length > 2));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;
  
  const jaccardSimilarity = intersection.size / union.size;

  // Also check for exact substring match (handles cases like "Sermon: Title" vs "Title")
  const contains = title1.includes(title2) || title2.includes(title1);
  const substringBonus = contains ? 0.3 : 0;

  return Math.min(1.0, jaccardSimilarity + substringBonus);
}

function isLikelySermon(title: string): boolean {
  const lowerTitle = title.toLowerCase();
  const sermonKeywords = ['sermon', 'message', 'preaching', 'teaching', '25-', 'fx', 'fxchurch'];
  
  return sermonKeywords.some(keyword => lowerTitle.includes(keyword));
}
