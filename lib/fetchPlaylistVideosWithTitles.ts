/**
 * Fetch playlist videos with titles by scraping the playlist page
 * This extracts both video IDs and titles from the YouTube playlist page
 */

export interface PlaylistVideoInfo {
  videoId: string;
  title: string;
  position: number;
}

/**
 * Extract video IDs and titles from YouTube playlist page
 */
export async function fetchPlaylistVideosWithTitles(
  playlistId: string
): Promise<PlaylistVideoInfo[]> {
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
    const videos: PlaylistVideoInfo[] = [];

    // Extract ytInitialData JSON from page
    const ytInitialDataMatch = html.match(/var ytInitialData = ({.*?});/s);
    
    if (ytInitialDataMatch) {
      try {
        const ytInitialData = JSON.parse(ytInitialDataMatch[1]);
        
        // Navigate through YouTube's nested structure to find playlist info
        const playlistContents = ytInitialData?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents ||
                                  ytInitialData?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents ||
                                  [];
        
        for (let i = 0; i < playlistContents.length; i++) {
          const item = playlistContents[i];
          const videoRenderer = item?.playlistVideoRenderer;
          
          if (videoRenderer) {
            const videoId = videoRenderer.videoId;
            // Extract title from the title object (can be simpleText or runs array)
            const title = videoRenderer.title?.simpleText || 
                         videoRenderer.title?.runs?.[0]?.text || 
                         '';
            
            if (videoId && title) {
              videos.push({
                videoId,
                title,
                position: i + 1,
              });
            }
          }
        }

        if (videos.length > 0) {
          return videos;
        }
      } catch (parseError) {
        console.error('[Playlist Videos] Error parsing playlist data:', parseError);
      }
    }

    // Fallback: Try to extract from HTML directly
    // Look for video titles in the HTML
    const videoTitlePattern = /"title":\s*\{[^}]*"simpleText":\s*"([^"]+)"/g;
    const videoIdPattern = /"videoId":\s*"([a-zA-Z0-9_-]{11})"/g;
    
    const titleMatches = Array.from(html.matchAll(videoTitlePattern));
    const idMatches = Array.from(html.matchAll(videoIdPattern));
    
    // Try to match titles with video IDs (this is less reliable)
    const seenIds = new Set<string>();
    for (let i = 0; i < Math.min(titleMatches.length, idMatches.length); i++) {
      const videoId = idMatches[i]?.[1];
      const title = titleMatches[i]?.[1];
      
      if (videoId && title && !seenIds.has(videoId)) {
        seenIds.add(videoId);
        videos.push({
          videoId,
          title: title.replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16))), // Decode unicode
          position: videos.length + 1,
        });
      }
    }

    return videos;
  } catch (error) {
    console.error(`[Playlist Videos] Error fetching playlist ${playlistId}:`, error);
    return [];
  }
}
