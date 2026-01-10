/**
 * Extracts YouTube transcripts using YouTube Data API v3
 * This is more reliable than scraping and works for videos with JavaScript-loaded captions
 * 
 * Setup:
 * 1. Get free API key: https://console.cloud.google.com/apis/credentials
 * 2. Enable "YouTube Data API v3"
 * 3. Add to Vercel env: YOUTUBE_API_KEY=your-key-here
 */

export interface YouTubeAPIExtractResult {
  success: boolean;
  transcript: string;
  title?: string;
  videoId?: string;
}

/**
 * Lists available caption tracks for a video using YouTube Data API v3
 */
async function listCaptionTracks(videoId: string, apiKey: string): Promise<any[]> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || JSON.stringify(errorData);
      
      // Check for specific error types
      if (response.status === 403) {
        if (errorMessage.includes('quota')) {
          throw new Error('YouTube API quota exceeded. Check Google Cloud Console for quota limits.');
        }
        if (errorMessage.includes('API key')) {
          throw new Error('YouTube API key is invalid or not authorized. Check your API key and ensure YouTube Data API v3 is enabled.');
        }
        throw new Error(`YouTube API access denied: ${errorMessage}. This may require API key permissions or quota issues.`);
      }
      if (response.status === 404) {
        throw new Error(`No caption tracks found for video ${videoId}. This video may not have captions enabled.`);
      }
      
      throw new Error(`YouTube API error: ${response.status} - ${errorMessage}`);
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error(`[YouTube API] Error listing caption tracks:`, error);
    throw error;
  }
}

/**
 * Downloads a caption track using YouTube Data API v3
 * ⚠️ IMPORTANT: captions.download endpoint REQUIRES OAuth2 authentication, not just an API key
 * However, we try it anyway because:
 * 1. Some public videos with auto-generated captions might work with API key
 * 2. We get better error messages to guide users
 * 3. We can verify captions exist via captions.list (which works with API key)
 */
async function downloadCaption(captionId: string, apiKey: string, languageCode: string = 'en'): Promise<string> {
  try {
    // Try different formats - ttml is most structured
    const formats = ['ttml', 'srt', 'vtt', 'txt'];
    
    for (const format of formats) {
      try {
        const url = `https://www.googleapis.com/youtube/v3/captions/${captionId}?key=${apiKey}&tfmt=${format}`;
        console.log(`[YouTube API] Trying to download caption in ${format} format...`);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': format === 'ttml' ? 'application/xml' : 'text/plain',
          },
        });

        if (response.ok) {
          const content = await response.text();
          if (content && content.length > 100) {
            console.log(`[YouTube API] Successfully downloaded caption in ${format} format (${content.length} chars)`);
            return content;
          }
        } else {
          const errorText = await response.text().catch(() => '');
          console.log(`[YouTube API] ${format} format failed: ${response.status} - ${errorText.substring(0, 100)}`);
        }
      } catch (formatError) {
        console.error(`[YouTube API] Error trying ${format} format:`, formatError);
        // Try next format
      }
    }

    // If all formats failed, try without format parameter
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/captions/${captionId}?key=${apiKey}`
      );
      
      if (response.ok) {
        const content = await response.text();
        if (content && content.length > 100) {
          console.log(`[YouTube API] Successfully downloaded caption (default format, ${content.length} chars)`);
          return content;
        }
      }
    } catch (error) {
      // Ignore and throw original error
    }

    // The captions.download endpoint requires OAuth2 authentication
    // However, we can try to use the caption track information to construct a timedtext URL
    // This is a workaround for public videos
    throw new Error(`Failed to download caption: YouTube Data API v3 captions.download requires OAuth2 authentication. For serverless functions, you may need to use YouTube's timedtext API directly with the track ID (advanced setup required).`);
  } catch (error) {
    console.error(`[YouTube API] Error downloading caption:`, error);
    throw error;
  }
}

/**
 * Extracts transcript from YouTube video using YouTube Data API v3
 */
export async function extractFromYouTubeAPI(
  videoId: string,
  apiKey: string
): Promise<YouTubeAPIExtractResult> {
  try {
    console.log(`[YouTube API] Fetching caption tracks for video: ${videoId}`);

    // List available caption tracks
    const captionTracks = await listCaptionTracks(videoId, apiKey);
    
    if (captionTracks.length === 0) {
      console.log(`[YouTube API] No caption tracks found for video ${videoId}`);
      return { success: false, transcript: "", videoId };
    }

    console.log(`[YouTube API] Found ${captionTracks.length} caption track(s)`);
    
    // Prefer English, fallback to first available
    let captionTrack = captionTracks.find(
      (track: any) => track.snippet.language === 'en' || track.snippet.language === 'en-US'
    );
    if (!captionTrack) {
      captionTrack = captionTracks.find((track: any) => track.snippet.language?.startsWith('en'));
    }
    if (!captionTrack) {
      captionTrack = captionTracks[0];
    }

    const captionId = captionTrack.id;
    const languageCode = captionTrack.snippet.language || 'en';
    const trackName = captionTrack.snippet.name || 'default';
    const isAutoGenerated = captionTrack.snippet.trackKind === 'ASR' || trackName.toLowerCase().includes('auto');

    console.log(`[YouTube API] Selected caption track: ${trackName} (${languageCode}), ID: ${captionId}, Auto-generated: ${isAutoGenerated}`);

    // Try to download the caption using multiple methods
    let captionContent: string | null = null;
    
    // Method 1: Try YouTube Data API v3 captions.download (requires OAuth2, but try anyway)
    try {
      captionContent = await downloadCaption(captionId, apiKey, languageCode);
      if (captionContent && captionContent.trim().length > 100) {
        console.log(`[YouTube API] Successfully downloaded via Data API v3`);
      }
    } catch (downloadError) {
      const errorMsg = downloadError instanceof Error ? downloadError.message : String(downloadError);
      console.log(`[YouTube API] Data API v3 download failed (expected - requires OAuth2): ${errorMsg.substring(0, 100)}`);
      
      // Method 2: Try YouTube's public timedtext API (no OAuth required!)
      // This is a workaround that uses the video ID and language code we already have
      try {
        console.log(`[YouTube API] Trying public timedtext API as fallback...`);
        const timedtextUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${languageCode}&fmt=json3`;
        
        const timedtextResponse = await fetch(timedtextUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; TranscriptBot/1.0)',
          },
        });
        
        if (timedtextResponse.ok) {
          const timedtextData = await timedtextResponse.json();
          
          // Parse JSON3 format (YouTube's timedtext API returns structured JSON)
          if (timedtextData.events && Array.isArray(timedtextData.events)) {
            const textParts = timedtextData.events
              .filter((event: any) => event.segs && Array.isArray(event.segs))
              .flatMap((event: any) => event.segs.map((seg: any) => seg.utf8 || ''))
              .filter((text: string) => text && text.trim().length > 0)
              .join(' ');
            
            if (textParts && textParts.trim().length > 100) {
              captionContent = textParts;
              console.log(`[YouTube API] ✅ Successfully downloaded via timedtext API (${textParts.length} chars)`);
            }
          }
          
          // If JSON3 doesn't work, try VTT format
          if (!captionContent || captionContent.trim().length < 100) {
            const timedtextVttUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${languageCode}&fmt=vtt`;
            const vttResponse = await fetch(timedtextVttUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; TranscriptBot/1.0)',
              },
            });
            
            if (vttResponse.ok) {
              const vttContent = await vttResponse.text();
              if (vttContent && vttContent.trim().length > 100) {
                captionContent = vttContent;
                console.log(`[YouTube API] ✅ Successfully downloaded via timedtext API (VTT format, ${vttContent.length} chars)`);
              }
            }
          }
        }
      } catch (timedtextError) {
        console.log(`[YouTube API] Timedtext API fallback also failed: ${timedtextError instanceof Error ? timedtextError.message : String(timedtextError)}`);
      }
      
      // If both methods failed, throw the original error
      if (!captionContent || captionContent.trim().length < 100) {
        throw new Error(`Caption download requires OAuth2 authentication. Tried Data API v3 and timedtext API, both failed. Consider using Whisper AI fallback.`);
      }
    }

    if (!captionContent || captionContent.trim().length < 100) {
      console.log(`[YouTube API] Caption content too short (${captionContent?.length || 0} chars)`);
      return { success: false, transcript: "", videoId };
    }

    // At this point, captionContent is guaranteed to be non-null
    const finalCaptionContent = captionContent;
    console.log(`[YouTube API] Downloaded caption content (${finalCaptionContent.length} chars)`);

    // Parse caption content based on format
    let textContent = '';
    
    if (finalCaptionContent.includes('<tt:') || finalCaptionContent.includes('<tt xmlns')) {
      // TTML format (XML)
      textContent = finalCaptionContent
        .replace(/<tt:[^>]*>([^<]*)<\/tt:[^>]*>/gi, '$1 ')
        .replace(/<[^>]*>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
    } else if (finalCaptionContent.includes('WEBVTT') || finalCaptionContent.includes('-->')) {
      // VTT/SRT format
      textContent = finalCaptionContent
        .replace(/WEBVTT[\s\S]*?\n\n/, '') // Remove WEBVTT header
        .replace(/\d+\n/g, '') // Remove sequence numbers (SRT)
        .replace(/\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}\n/gi, '') // Remove timestamps
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
        .replace(/\s+/g, ' ')
        .trim();
    } else {
      // Plain text
      textContent = finalCaptionContent.trim();
    }

    if (textContent.length < 100) {
      console.log(`[YouTube API] Parsed text too short (${textContent.length} chars)`);
      return { success: false, transcript: "", videoId };
    }

    // Format into readable paragraphs
    const sentences = textContent
      .replace(/\. +/g, ".\n")
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const paragraphs: string[] = [];
    let currentParagraph = "";

    for (const sentence of sentences) {
      if (currentParagraph.length + sentence.length > 500) {
        if (currentParagraph) paragraphs.push(currentParagraph.trim());
        currentParagraph = sentence;
      } else {
        currentParagraph += (currentParagraph ? " " : "") + sentence;
      }
    }

    if (currentParagraph) {
      paragraphs.push(currentParagraph.trim());
    }

    const transcript = paragraphs.join("\n\n");

    if (transcript.trim().length > 100) {
      console.log(`[YouTube API] Successfully extracted transcript (${transcript.length} chars)`);
      return {
        success: true,
        transcript,
        videoId,
      };
    }

    console.log(`[YouTube API] Transcript too short after formatting (${transcript.length} chars)`);
    return { success: false, transcript: "", videoId };
  } catch (error) {
    console.error(`[YouTube API] Error extracting transcript:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Provide helpful error messages
    if (errorMessage.includes('API key')) {
      throw new Error('YouTube API key is invalid or missing. Please check YOUTUBE_API_KEY environment variable.');
    }
    if (errorMessage.includes('403') || errorMessage.includes('quota')) {
      throw new Error('YouTube API quota exceeded or API not enabled. Check Google Cloud Console.');
    }
    if (errorMessage.includes('404')) {
      return { success: false, transcript: "", videoId };
    }
    
    throw error;
  }
}
