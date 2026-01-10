/**
 * Fetches all videos from a YouTube channel
 * Note: YouTube API v3 requires an API key, but we can also scrape the channel page
 */

export interface YouTubeVideo {
  videoId: string;
  title: string;
  description: string;
  publishedAt: Date;
  url: string;
  thumbnailUrl: string;
}

/**
 * Fetches YouTube channel videos by scraping the channel page
 * Alternative: Use YouTube Data API v3 with API key (more reliable)
 */
export async function fetchYouTubeCatalog(
  channelHandle: string = '@fxchurch'
): Promise<YouTubeVideo[]> {
  try {
    // Try to fetch channel page
    // Channel URL format: https://www.youtube.com/@fxchurch/videos
    const channelUrl = `https://www.youtube.com/${channelHandle}/videos`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(channelUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Failed to fetch YouTube channel: ${response.status}`);
    }

    const html = await response.text();
    const videos: YouTubeVideo[] = [];

    // Extract ytInitialData JSON from page
    const ytInitialDataMatch = html.match(/var ytInitialData = ({.*?});/s);
    
    if (ytInitialDataMatch) {
      try {
        const ytInitialData = JSON.parse(ytInitialDataMatch[1]);
        
        // Navigate through YouTube's nested structure to find videos
        const contents = ytInitialData?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
        
        for (const tab of contents) {
          const tabRenderer = tab.tabRenderer;
          if (tabRenderer?.content?.richGridRenderer?.contents) {
            const gridContents = tabRenderer.content.richGridRenderer.contents;
            
            for (const item of gridContents) {
              const videoRenderer = item?.richItemRenderer?.content?.videoRenderer ||
                                  item?.videoRenderer;
              
              if (videoRenderer) {
                const videoId = videoRenderer.videoId;
                const title = videoRenderer.title?.runs?.[0]?.text || 
                             videoRenderer.title?.simpleText || '';
                const description = videoRenderer.descriptionSnippet?.runs?.[0]?.text || '';
                const publishedTimeText = videoRenderer.publishedTimeText?.simpleText || '';
                
                // Try to extract published date
                let publishedAt = new Date();
                // YouTube shows relative dates, we'll use current date as fallback
                // For more accurate dates, use YouTube Data API v3
                
                if (videoId && title) {
                  videos.push({
                    videoId,
                    title,
                    description,
                    publishedAt,
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                    thumbnailUrl: videoRenderer.thumbnail?.thumbnails?.[0]?.url || '',
                  });
                }
              }
            }
          }
        }
      } catch (parseError) {
        console.error('Error parsing YouTube data:', parseError);
      }
    }

    // Alternative: Try to extract video IDs from inline JSON
    if (videos.length === 0) {
      // Fallback: Extract video IDs from the HTML
      const videoIdPattern = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
      const matches = Array.from(html.matchAll(videoIdPattern));
      
      const seenIds = new Set<string>();
      for (const match of matches) {
        const videoId = match[1];
        if (!seenIds.has(videoId)) {
          seenIds.add(videoId);
          videos.push({
            videoId,
            title: '', // Will be fetched later or from transcript extraction
            description: '',
            publishedAt: new Date(),
            url: `https://www.youtube.com/watch?v=${videoId}`,
            thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          });
        }
      }
    }

    return videos.slice(0, 50); // Limit to 50 most recent
  } catch (error) {
    console.error('Error fetching YouTube catalog:', error);
    throw error;
  }
}

/**
 * Alternative: Use YouTube Data API v3 (requires API key)
 * This is more reliable and gets accurate dates
 */
export async function fetchYouTubeCatalogAPI(
  channelId: string,
  apiKey: string
): Promise<YouTubeVideo[]> {
  try {
    // Get channel uploads playlist ID
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`
    );
    
    if (!channelResponse.ok) {
      throw new Error('Failed to fetch channel data');
    }
    
    const channelData = await channelResponse.json();
    const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    
    if (!uploadsPlaylistId) {
      throw new Error('Could not find uploads playlist');
    }
    
    // Get videos from uploads playlist
    const videosResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50&key=${apiKey}`
    );
    
    if (!videosResponse.ok) {
      throw new Error('Failed to fetch videos');
    }
    
    const videosData = await videosResponse.json();
    const videos: YouTubeVideo[] = videosData.items?.map((item: any) => ({
      videoId: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      publishedAt: new Date(item.snippet.publishedAt),
      url: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
      thumbnailUrl: item.snippet.thumbnails?.high?.url || '',
    })) || [];
    
    return videos;
  } catch (error) {
    console.error('Error fetching YouTube catalog via API:', error);
    throw error;
  }
}
