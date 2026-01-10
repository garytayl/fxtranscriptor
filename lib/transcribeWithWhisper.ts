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
    
    // Use the new router endpoint (migrated from api-inference.huggingface.co)
    // Format: https://router.huggingface.co/models/{model_id}
    const apiUrl = 'https://router.huggingface.co/models/openai/whisper-large-v3';
    
    console.log(`[Whisper] Using Hugging Face Router API: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: base64Audio,
      }),
    });

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
