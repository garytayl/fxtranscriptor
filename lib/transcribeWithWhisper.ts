/**
 * Transcribes audio using Hugging Face Whisper API (FREE tier)
 * 
 * This is the fallback when YouTube/Podbean transcripts aren't accessible
 * Works for ANY video/audio file (even without captions)
 * 
 * Setup:
 * 1. Get free API key: https://huggingface.co/settings/tokens
 * 2. Add to Vercel env: HUGGINGFACE_API_KEY=your-key-here
 * 
 * Free Tier: 30 hours/month transcription
 */

export interface WhisperTranscribeResult {
  success: boolean;
  transcript: string;
  error?: string;
}

/**
 * Downloads audio from a URL and converts to format suitable for Whisper
 */
async function downloadAudio(audioUrl: string): Promise<Buffer> {
  try {
    console.log(`[Whisper] Downloading audio from: ${audioUrl.substring(0, 100)}...`);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60 second timeout for audio downloads
    
    const response = await fetch(audioUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TranscriptBot/1.0)',
        'Accept': 'audio/*',
      },
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`[Whisper] Downloaded audio (${buffer.length} bytes, ~${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
    return buffer;
  } catch (error) {
    console.error(`[Whisper] Error downloading audio:`, error);
    throw error;
  }
}

/**
 * Transcribes audio using Hugging Face Whisper API
 * Uses free tier - 30 hours/month, very accurate
 */
export async function transcribeWithWhisper(
  audioUrl: string,
  apiKey?: string
): Promise<WhisperTranscribeResult> {
  try {
    if (!apiKey || apiKey.trim().length === 0) {
      return {
        success: false,
        transcript: "",
        error: "Hugging Face API key not configured. Add HUGGINGFACE_API_KEY to Vercel environment variables.",
      };
    }

    console.log(`[Whisper] Starting transcription for audio: ${audioUrl.substring(0, 100)}...`);
    
    // Download audio file
    const audioBuffer = await downloadAudio(audioUrl);
    
    // Check file size (free tier has limits, but 30 hours/month is generous)
    const sizeMB = audioBuffer.length / 1024 / 1024;
    if (sizeMB > 100) {
      console.warn(`[Whisper] Audio file is large (${sizeMB.toFixed(2)} MB), transcription may take longer`);
    }
    
    console.log(`[Whisper] Sending audio to Hugging Face Whisper API...`);
    
    // Use Hugging Face Router API - free tier, no credit card required
    // Model: openai/whisper-large-v3 (most accurate)
    // Updated to use router.huggingface.co (api-inference.huggingface.co is deprecated as of 2024)
    // Hugging Face accepts audio as base64-encoded string in JSON format
    // Note: This works for Node.js serverless environments
    const base64Audio = audioBuffer.toString('base64');
    
    // Try multiple endpoint formats - Hugging Face has been migrating endpoints
    // Try the old endpoint first (may still work despite deprecation warning)
    // Then try router endpoints with different formats
    const endpoints = [
      'https://api-inference.huggingface.co/models/openai/whisper-large-v3', // Original (try first - may still work)
      'https://router.huggingface.co/models/openai/whisper-large-v3', // Router format 1
      'https://router.huggingface.co/openai/whisper-large-v3', // Router format 2
      'https://api-inference.huggingface.co/models/whisper-large-v3', // Alternative model path
    ];
    
    let response: Response | null = null;
    let apiUrl = '';
    let lastError: string | null = null;
    
    for (const endpoint of endpoints) {
      apiUrl = endpoint;
      console.log(`[Whisper] Trying Hugging Face endpoint: ${apiUrl}`);
      
      try {
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: base64Audio,
          }),
        });
        
        // If we get a valid response (200) or a model-loading response (503), use this endpoint
        if (response.status === 200 || response.status === 503) {
          console.log(`[Whisper] Using Hugging Face endpoint: ${apiUrl} (status: ${response.status})`);
          break;
        }
        
        // If 404 or other error, try next endpoint
        if (response.status === 404) {
          const errorText = await response.text().catch(() => '');
          lastError = `${response.status} - ${errorText.substring(0, 100)}`;
          console.log(`[Whisper] Endpoint ${apiUrl} returned 404, trying next...`);
          response = null;
          continue;
        }
        
        // If 410 (Gone) - deprecated endpoint, but might still work
        // Sometimes deprecated endpoints still return data despite the status code
        // Try to read the response body and check if it contains valid data
        if (response.status === 410) {
          console.log(`[Whisper] Endpoint ${apiUrl} is deprecated (410), checking if response contains data...`);
          try {
            const responseText = await response.text();
            lastError = `${response.status} - ${responseText.substring(0, 200)}`;
            
            // Check if the response contains the deprecation message but also data
            // Sometimes the 410 response includes the actual data along with a deprecation message
            if (responseText.includes('"text"') || responseText.includes('router.huggingface.co')) {
              // If it mentions router, the endpoint is truly gone - try next
              console.log(`[Whisper] Endpoint ${apiUrl} is deprecated (410) with migration message, trying next...`);
              response = null;
              continue;
            }
            
            // Try to parse as JSON - if it contains transcript data, use it
            try {
              const jsonData = JSON.parse(responseText);
              if (jsonData.text || (Array.isArray(jsonData) && jsonData.length > 0)) {
                console.log(`[Whisper] Deprecated endpoint returned valid data despite 410, using it...`);
                // Create a new Response object with status 200 for downstream processing
                response = new Response(responseText, { 
                  status: 200, 
                  headers: { 'Content-Type': 'application/json' }
                });
                break;
              }
            } catch {
              // Not valid JSON with transcript data, continue to next endpoint
              console.log(`[Whisper] Endpoint ${apiUrl} returned 410 without valid transcript data, trying next...`);
            }
          } catch (readError) {
            // Can't read response, continue to next endpoint
            console.log(`[Whisper] Error reading 410 response: ${readError}`);
          }
          response = null;
          continue;
        }
        
        // For other status codes, break and handle error below
        break;
      } catch (fetchError) {
        console.log(`[Whisper] Error trying endpoint ${apiUrl}:`, fetchError);
        lastError = fetchError instanceof Error ? fetchError.message : String(fetchError);
        response = null;
        continue;
      }
    }
    
    if (!response) {
      const errorMsg = `Hugging Face Inference API endpoints are currently unavailable or migrated.

Last error: ${lastError || 'Unknown error'}

Possible causes:
• Hugging Face is migrating from api-inference.huggingface.co to router.huggingface.co
• The router endpoint format may have changed
• The model may require license acceptance (visit https://huggingface.co/openai/whisper-large-v3)

Solutions:
1. Check Hugging Face status: https://status.huggingface.co
2. Try again later (migration may be in progress)
3. Use an alternative transcription service (OpenAI Whisper API, AssemblyAI)
4. Accept model license on Hugging Face if required

For updates, check: https://huggingface.co/docs/api-inference`;
      
      return {
        success: false,
        transcript: "",
        error: errorMsg,
      };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
      
      console.error(`[Whisper] Hugging Face API error: ${response.status} - ${errorMessage}`);
      
      if (response.status === 503) {
        // Model is loading (first request)
        return {
          success: false,
          transcript: "",
          error: "Hugging Face model is loading. Please wait 10-20 seconds and try again.",
        };
      }
      
      if (response.status === 429) {
        return {
          success: false,
          transcript: "",
          error: "Hugging Face rate limit exceeded. Free tier allows ~30 hours/month. Please try again later.",
        };
      }
      
      if (response.status === 404) {
        return {
          success: false,
          transcript: "",
          error: `Hugging Face endpoint not found (404). The API endpoint format may have changed. 

Current endpoint: ${apiUrl}

Please check Hugging Face documentation for the latest endpoint format:
https://huggingface.co/docs/api-inference

Or check if the model requires license acceptance:
https://huggingface.co/openai/whisper-large-v3`,
        };
      }
      
      throw new Error(`Hugging Face API error: ${response.status} - ${errorMessage}`);
    }

    const result = await response.json();
    
    // Hugging Face returns: { text: "transcript..." } or array of segments
    let transcript = '';
    
    if (typeof result === 'string') {
      transcript = result;
    } else if (result.text) {
      transcript = result.text;
    } else if (Array.isArray(result) && result.length > 0) {
      // If it's an array of segments, combine them
      transcript = result.map((segment: any) => segment.text || segment.transcript || '').join(' ');
    } else if (result.chunks && Array.isArray(result.chunks)) {
      transcript = result.chunks.map((chunk: any) => chunk.text || '').join(' ');
    } else {
      console.error(`[Whisper] Unexpected response format:`, JSON.stringify(result).substring(0, 200));
      throw new Error('Unexpected response format from Hugging Face API');
    }
    
    if (!transcript || transcript.trim().length < 100) {
      console.error(`[Whisper] Transcript too short (${transcript.length} chars)`);
      return {
        success: false,
        transcript: "",
        error: "Transcript is too short or empty. The audio might be too short, silent, or in an unsupported format.",
      };
    }

    console.log(`[Whisper] ✅ Successfully transcribed audio (${transcript.length} chars)`);
    
    // Clean and format transcript
    const cleaned = transcript
      .replace(/\s+/g, ' ')
      .replace(/\. +/g, '.\n')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n\n')
      .trim();

    return {
      success: true,
      transcript: cleaned,
    };
  } catch (error) {
    console.error(`[Whisper] Error transcribing audio:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      success: false,
      transcript: "",
      error: `Whisper transcription failed: ${errorMessage}`,
    };
  }
}
