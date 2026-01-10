/**
 * Fetch YouTube playlist information
 * Can work with or without YouTube Data API v3
 */

export interface YouTubePlaylist {
  playlistId: string;
  title: string;
  description: string | null;
  videoIds: string[];
  videoCount: number;
  thumbnailUrl: string | null;
}

export interface YouTubePlaylistVideo {
  videoId: string;
  title: string;
  description: string;
  position: number; // Position in playlist
  publishedAt: Date | null;
  thumbnailUrl: string | null;
}

/**
 * Extract playlist ID from YouTube playlist URL
 * Handles formats like:
 * - https://youtube.com/playlist?list=PLQwpPWOYg4MOLr9lUNMBgjCCV0ifkKMDu
 * - https://www.youtube.com/playlist?list=PLQwpPWOYg4MOLr9lUNMBgjCCV0ifkKMDu
 */
export function extractPlaylistId(url: string): string | null {
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Fetch playlist data using YouTube Data API v3 (recommended - requires API key)
 */
export async function fetchYouTubePlaylistAPI(
  playlistId: string,
  apiKey: string
): Promise<YouTubePlaylist | null> {
  try {
    // First, get playlist metadata
    const playlistResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&id=${playlistId}&key=${apiKey}`
    );

    if (!playlistResponse.ok) {
      const error = await playlistResponse.json().catch(() => ({}));
      if (playlistResponse.status === 404) {
        console.log(`[YouTube Playlist] Playlist ${playlistId} not found`);
        return null;
      }
      throw new Error(`Failed to fetch playlist: ${playlistResponse.status} - ${JSON.stringify(error)}`);
    }

    const playlistData = await playlistResponse.json();
    if (!playlistData.items || playlistData.items.length === 0) {
      console.log(`[YouTube Playlist] Playlist ${playlistId} not found`);
      return null;
    }

    const playlist = playlistData.items[0];
    const title = playlist.snippet.title;
    const description = playlist.snippet.description || null;
    const thumbnailUrl = playlist.snippet.thumbnails?.high?.url || playlist.snippet.thumbnails?.default?.url || null;
    const videoCount = playlist.contentDetails?.itemCount || 0;

    // Get all videos in the playlist (paginated)
    const videoIds: string[] = [];
    let nextPageToken: string | undefined = undefined;

    while (true) {
      const pageTokenParam = nextPageToken ? `&pageToken=${nextPageToken}` : '';
      const videosUrl: string = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50${pageTokenParam}&key=${apiKey}`;
      
      const videosResponse = await fetch(videosUrl);
      if (!videosResponse.ok) {
        throw new Error(`Failed to fetch playlist videos: ${videosResponse.status}`);
      }

      const videosData = await videosResponse.json();
      
      for (const item of videosData.items || []) {
        const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
        if (videoId) {
          videoIds.push(videoId);
        }
      }

      nextPageToken = videosData.nextPageToken;
      if (!nextPageToken) {
        break;
      }
    }

    return {
      playlistId,
      title,
      description,
      videoIds,
      videoCount: videoIds.length,
      thumbnailUrl,
    };
  } catch (error) {
    console.error(`[YouTube Playlist API] Error fetching playlist ${playlistId}:`, error);
    throw error;
  }
}

/**
 * Fetch playlist data by scraping the playlist page (fallback - no API key needed)
 * This is less reliable but works without an API key
 */
export async function fetchYouTubePlaylistScrape(
  playlistId: string
): Promise<YouTubePlaylist | null> {
  try {
    const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(playlistUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Failed to fetch playlist page: ${response.status}`);
    }

    const html = await response.text();
    const videoIds: string[] = [];

    // Extract ytInitialData JSON from page
    const ytInitialDataMatch = html.match(/var ytInitialData = ({.*?});/s);
    
    if (ytInitialDataMatch) {
      try {
        const ytInitialData = JSON.parse(ytInitialDataMatch[1]);
        
        // Navigate through YouTube's nested structure to find playlist info
        // This structure varies, so we try multiple paths
        const playlistContents = ytInitialData?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents ||
                                  ytInitialData?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents ||
                                  [];
        
        for (const item of playlistContents) {
          const videoId = item?.playlistVideoRenderer?.videoId;
          if (videoId) {
            videoIds.push(videoId);
          }
        }

        // Extract playlist title
        const playlistTitle = ytInitialData?.metadata?.playlistMetadataRenderer?.title ||
                             ytInitialData?.contents?.twoColumnBrowseResultsRenderer?.header?.playlistHeaderRenderer?.title?.simpleText ||
                             'Untitled Playlist';

        if (videoIds.length > 0) {
          return {
            playlistId,
            title: playlistTitle,
            description: null,
            videoIds,
            videoCount: videoIds.length,
            thumbnailUrl: null,
          };
        }
      } catch (parseError) {
        console.error('[YouTube Playlist Scrape] Error parsing playlist data:', parseError);
      }
    }

    // Fallback: Extract video IDs directly from HTML
    const videoIdPattern = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
    const matches = Array.from(html.matchAll(videoIdPattern));
    const seenIds = new Set<string>();
    
    for (const match of matches) {
      const videoId = match[1];
      if (!seenIds.has(videoId)) {
        seenIds.add(videoId);
        videoIds.push(videoId);
      }
    }

    if (videoIds.length > 0) {
      // Try to extract title from page title
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      const title = titleMatch
        ? titleMatch[1].replace(/\s*-\s*YouTube$/, '').trim()
        : 'Untitled Playlist';

      return {
        playlistId,
        title,
        description: null,
        videoIds,
        videoCount: videoIds.length,
        thumbnailUrl: null,
      };
    }

    return null;
  } catch (error) {
    console.error(`[YouTube Playlist Scrape] Error fetching playlist ${playlistId}:`, error);
    return null;
  }
}

/**
 * Fetch playlist data (tries API first, falls back to scraping)
 */
export async function fetchYouTubePlaylist(
  playlistIdOrUrl: string,
  apiKey?: string
): Promise<YouTubePlaylist | null> {
  // Extract playlist ID if URL is provided
  const playlistId = playlistIdOrUrl.includes('list=') 
    ? extractPlaylistId(playlistIdOrUrl)
    : playlistIdOrUrl;

  if (!playlistId) {
    throw new Error('Invalid playlist ID or URL');
  }

  // Try API first if key is provided
  if (apiKey && apiKey.trim().length > 0) {
    try {
      console.log(`[YouTube Playlist] Fetching playlist ${playlistId} via API...`);
      const playlist = await fetchYouTubePlaylistAPI(playlistId, apiKey);
      if (playlist) {
        console.log(`[YouTube Playlist] ✅ Successfully fetched playlist "${playlist.title}" with ${playlist.videoCount} videos`);
        return playlist;
      }
    } catch (apiError) {
      console.warn(`[YouTube Playlist] API fetch failed, trying scrape method:`, apiError);
    }
  }

  // Fallback to scraping
  console.log(`[YouTube Playlist] Fetching playlist ${playlistId} via scraping...`);
  const playlist = await fetchYouTubePlaylistScrape(playlistId);
  if (playlist) {
    console.log(`[YouTube Playlist] ✅ Successfully scraped playlist "${playlist.title}" with ${playlist.videoCount} videos`);
  }
  
  return playlist;
}
