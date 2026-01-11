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
    
    console.log(`[Whisper] Sending audio to Hugging Face Whisper API via Inference Providers router...`);
    
    // Use Hugging Face Inference Providers router (api-inference.huggingface.co is decommissioned)
    // Correct endpoint format: https://router.huggingface.co/{provider}/models/{model_id}
    // Provider: hf-inference (HF's own provider) or fal-ai (third-party fallback)
    // Model: openai/whisper-large-v3 (most accurate)
    // 
    // Request format: Send raw audio bytes with correct Content-Type (preferred)
    // OR send base64 JSON with inputs field (for timestamps)
    //
    // IMPORTANT: Token must have "Make calls to Inference Providers" permission (not just Read)
    
    // Detect audio format from buffer or default to mpeg
    const audioFormat = 'audio/mpeg'; // M4A files work with mpeg Content-Type
    const audioBase64 = audioBuffer.toString('base64');
    
    // Try endpoints in order: hf-inference (primary), fal-ai (fallback)
    // Note: Base64 fallback disabled for large files (>10MB) - adds 33% overhead, makes 502s worse
    const endpoints: Array<{ url: string; provider: string; useRawBytes: boolean }> = [
      {
        url: 'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3',
        provider: 'hf-inference',
        useRawBytes: true, // Try raw bytes first (simpler, faster)
      },
    ];
    
    // Only add base64 fallback for small files (base64 adds 33% overhead, counterproductive for large files)
    if (sizeMB <= NO_BASE64_FALLBACK_MB) {
      endpoints.push({
        url: 'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3',
        provider: 'hf-inference',
        useRawBytes: false, // Fallback to JSON only for small files
      });
    }
    
    // Add fal-ai provider fallback (always try, regardless of size)
    endpoints.push({
      url: 'https://router.huggingface.co/fal-ai/models/openai/whisper-large-v3',
      provider: 'fal-ai',
      useRawBytes: true, // Try fal-ai provider as fallback
    });
    
    let response: Response | null = null;
    let apiUrl = '';
    let lastError: string | null = null;
    
    for (const endpointConfig of endpoints) {
      apiUrl = endpointConfig.url;
      const provider = endpointConfig.provider;
      const useRawBytes = endpointConfig.useRawBytes;
      
      console.log(`[Whisper] Trying Hugging Face endpoint: ${apiUrl} (provider: ${provider}, format: ${useRawBytes ? 'raw bytes' : 'JSON base64'})`);
      
      try {
        // Method 1: Send raw audio bytes (preferred - simpler, faster)
        if (useRawBytes) {
          // Convert Buffer to Uint8Array for TypeScript compatibility (Buffer extends Uint8Array)
          const audioBytes = new Uint8Array(audioBuffer);
          
          // Detect correct Content-Type from URL extension
          const contentType = audioUrl.includes('.m4a') ? 'audio/mp4' : 
                             audioUrl.includes('.mp3') ? 'audio/mpeg' :
                             audioUrl.includes('.wav') ? 'audio/wav' :
                             audioUrl.includes('.ogg') ? 'audio/ogg' :
                             'audio/mpeg'; // Default fallback
          
          console.log(`[Whisper] Sending ${audioBytes.length} bytes (${(audioBytes.length / 1024 / 1024).toFixed(2)} MB) with Content-Type: ${contentType}`);
          
          response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': contentType,
            },
            body: audioBytes, // Send raw bytes as Uint8Array
          });
        } 
        // Method 2: Send base64 JSON (for timestamps or if raw bytes fail)
        else {
          response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inputs: audioBase64,
              // Optional: uncomment for timestamps
              // parameters: { return_timestamps: true },
            }),
          });
        }
        
        // Read the response body once (we can't read it multiple times)
        const responseText = await response.text();
        
        // If we get a valid response (200) or a model-loading response (503), use this endpoint
        if (response.status === 200 || response.status === 503) {
          console.log(`[Whisper] ✅ Using Hugging Face endpoint: ${apiUrl} (provider: ${provider}, format: ${useRawBytes ? 'raw bytes' : 'JSON'}, status: ${response.status})`);
          // Reconstruct response with text for downstream processing
          response = new Response(responseText, { 
            status: response.status, 
            headers: response.headers 
          });
          break;
        }
        
        // If 404, provider/model not found - try next endpoint
        if (response.status === 404) {
          lastError = `${response.status} - ${responseText.substring(0, 200)}`;
          console.log(`[Whisper] Endpoint ${apiUrl} returned 404 (provider or model not found), trying next...`);
          response = null;
          continue;
        }
        
        // If 400, bad request - likely format or size issue
        if (response.status === 400) {
          lastError = `${response.status} - ${responseText.substring(0, 500)}`;
          console.log(`[Whisper] Endpoint ${apiUrl} returned 400 (bad request)`);
          console.log(`[Whisper] Error details: ${responseText.substring(0, 500)}`);
          
          // Try to extract specific error message
          try {
            const errorJson = JSON.parse(responseText);
            const errorMsg = errorJson.error || errorJson.message || errorJson.details || responseText.substring(0, 200);
            lastError = `${response.status} - ${errorMsg}`;
          } catch {
            // Not JSON, use text as-is
          }
          
          // Don't try other endpoints if it's a 400 (format issue won't be fixed by different endpoint)
          response = null;
          break;
        }
        
        // If 502/503/504, server error or timeout - retry once, then try next endpoint/format
        if (response.status === 502 || response.status === 503 || response.status === 504) {
          lastError = `${response.status} - ${responseText.substring(0, 200)}`;
          console.log(`[Whisper] Endpoint ${apiUrl} returned ${response.status} (server error/timeout)`);
          console.log(`[Whisper] This may be due to large file size or server overload. Will retry with different provider/format...`);
          response = null;
          continue; // Try next endpoint/format or provider
        }
        
        // If 401/403, token permission issue - check if it's missing Inference Providers permission
        if (response.status === 401 || response.status === 403) {
          lastError = `${response.status} - ${responseText.substring(0, 200)}`;
          console.log(`[Whisper] Endpoint ${apiUrl} returned ${response.status} (authentication/permission error)`);
          if (responseText.includes('Inference Providers') || responseText.includes('permission')) {
            console.log(`[Whisper] Token may be missing "Make calls to Inference Providers" permission. Check token settings.`);
          }
          // Don't try other endpoints if it's a token issue - same token will fail everywhere
          response = null;
          break;
        }
        
        // For other status codes (like 429 rate limit, 500 server error), break and handle error below
        lastError = `${response.status} - ${responseText.substring(0, 200)}`;
        break;
      } catch (fetchError) {
        console.log(`[Whisper] Error trying endpoint ${apiUrl}:`, fetchError);
        lastError = fetchError instanceof Error ? fetchError.message : String(fetchError);
        response = null;
        continue;
      }
    }
    
    if (!response) {
      // Build error message based on last error
      let errorMsg = `Hugging Face Inference Providers API failed.

Last error: ${lastError || 'Unknown error'}`;

      // Check if it was a 502/503/504 (server error/timeout)
      if (lastError?.includes('502') || lastError?.includes('503') || lastError?.includes('504')) {
        errorMsg += `

Possible causes:
• Audio file too large for shared inference infrastructure (common for 60-90 min sermons)
• Server timeout or overload
• Provider gateway choked on payload size

Recommended solution:
1. **Chunk audio**: Split into ~10 minute segments using preprocessing worker (Railway/Render/Fly)
   - Worker downloads audio, splits with ffmpeg, uploads chunks to storage
   - Vercel orchestrates chunk transcription and merges results
   - See AUDIO_PREPROCESSING.md for implementation details
   
Alternative solutions:
2. Compress audio: Convert to MP3 16kHz mono 64kbps (reduces file size dramatically)
3. Use paid transcription service: OpenAI Whisper API, AssemblyAI, or Deepgram (handles large files better)

For API documentation: https://huggingface.co/docs/inference-providers/en/tasks/automatic-speech-recognition`;
      } else {
        errorMsg += `

Possible causes:
• Token missing "Make calls to Inference Providers" permission (check token settings)
• All endpoint attempts failed (hf-inference and fal-ai providers)
• Rate limit or quota exceeded (free tier has limited monthly credits)

Solutions:
1. Check token permissions at https://huggingface.co/settings/tokens
   - Create new token with "Make calls to Inference Providers" enabled
   - Update HUGGINGFACE_API_KEY in Vercel
2. Check Hugging Face status: https://status.huggingface.co
3. Verify free tier credits: https://huggingface.co/pricing
4. Use an alternative transcription service (OpenAI Whisper API, AssemblyAI)

For API documentation: https://huggingface.co/docs/inference-providers/en/tasks/automatic-speech-recognition`;
      }
      
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
          error: `Hugging Face endpoint not found (404). Provider or model may not be available.

Current endpoint: ${apiUrl}

Please check:
• Model availability: https://huggingface.co/openai/whisper-large-v3
• API documentation: https://huggingface.co/docs/inference-providers/en/tasks/automatic-speech-recognition
• Try alternative provider (fal-ai) if hf-inference fails`,
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
