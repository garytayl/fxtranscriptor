/**
 * Transcription module for Railway worker
 * Handles Whisper AI transcription via Hugging Face
 * Uses fetch() instead of axios to match Vercel implementation exactly
 */

const axios = require('axios'); // Still used for downloading audio
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

/**
 * Check if URL is a YouTube URL
 */
function isYouTubeUrl(url) {
  return url && (url.includes('youtube.com/watch') || url.includes('youtu.be/'));
}

/**
 * Extract video ID from YouTube URL
 */
function extractYouTubeVideoId(url) {
  if (!url) return null;
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  return null;
}

/**
 * Extract video ID from YouTube URL
 */
function extractYouTubeVideoId(url) {
  if (!url) return null;
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  return null;
}

/**
 * Download audio from YouTube using yt-dlp (more reliable, handles bot detection better)
 */
async function downloadYouTubeAudioBuffer(youtubeUrl) {
  const videoId = extractYouTubeVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error(`Invalid YouTube URL: ${youtubeUrl}`);
  }

  console.log(`[Transcribe] Extracting audio from YouTube video: ${videoId} using yt-dlp`);

  // Create temp directory for download
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ytdlp-'));
  const tempFile = path.join(tempDir, `audio_${videoId}.m4a`);

  try {
    // Use yt-dlp to download audio (handles bot detection much better)
    // -x: extract audio only
    // --audio-format m4a: output as m4a
    // --audio-quality 0: best quality
    // -o: output file
    const command = `yt-dlp -x --audio-format m4a --audio-quality 0 -o "${tempFile}" "${youtubeUrl}"`;
    
    console.log(`[Transcribe] Running: yt-dlp for video ${videoId}`);
    const { stdout, stderr } = await execAsync(command, {
      timeout: 600000, // 10 minutes timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    if (stderr && !stderr.includes('[download]')) {
      console.warn(`[Transcribe] yt-dlp warnings: ${stderr}`);
    }

    // Read the downloaded file into a buffer
    const audioBuffer = await fs.readFile(tempFile);
    const audioSizeMB = audioBuffer.length / 1024 / 1024;
    console.log(`[Transcribe] ✅ YouTube audio extracted: ${audioSizeMB.toFixed(2)} MB`);

    // Cleanup temp file
    try {
      await fs.unlink(tempFile);
      await fs.rmdir(tempDir);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    return audioBuffer;
  } catch (error) {
    // Cleanup on error
    try {
      await fs.unlink(tempFile).catch(() => {});
      await fs.rmdir(tempDir).catch(() => {});
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    console.error(`[Transcribe] yt-dlp error:`, error);
    let errorMessage = `Failed to download YouTube audio: ${error.message}`;
    
    if (error.message.includes('Sign in to confirm') || error.message.includes('bot')) {
      errorMessage = `YouTube bot detection: ${error.message}. yt-dlp should handle this better, but YouTube may be blocking automated access.`;
    }
    
    throw new Error(errorMessage);
  }
}

/**
 * Transcribe audio file using Hugging Face Whisper API
 * Matches Vercel implementation exactly (uses fetch, not axios)
 * Now supports both direct audio URLs (Podbean) and YouTube URLs
 */
async function transcribeAudio(audioUrl, retries = 5) {
  if (!HUGGINGFACE_API_KEY) {
    throw new Error('HUGGINGFACE_API_KEY not configured');
  }

  console.log(`[Transcribe] Starting transcription for: ${audioUrl.substring(0, 80)}...`);

  let audioBuffer;
  let audioSizeMB;

  // Check if it's a YouTube URL
  if (isYouTubeUrl(audioUrl)) {
    // Extract audio from YouTube
    audioBuffer = await downloadYouTubeAudioBuffer(audioUrl);
    audioSizeMB = audioBuffer.length / 1024 / 1024;
  } else {
    // Download audio from direct URL (Podbean, etc.)
    const audioResponse = await axios({
      url: audioUrl,
      method: 'GET',
      responseType: 'arraybuffer',
      timeout: 300000, // 5 minutes
    });

    audioBuffer = Buffer.from(audioResponse.data);
    audioSizeMB = audioBuffer.length / 1024 / 1024;
    console.log(`[Transcribe] Downloaded audio: ${audioSizeMB.toFixed(2)} MB`);
  }

  // Convert Buffer to Uint8Array (matches Vercel implementation)
  const audioBytes = new Uint8Array(audioBuffer);

  // Determine content type (matches Vercel logic)
  const contentType = audioUrl.includes('.m4a') ? 'audio/mp4' : 
                     audioUrl.includes('.mp3') ? 'audio/mpeg' :
                     audioUrl.includes('.wav') ? 'audio/wav' :
                     audioUrl.includes('.ogg') ? 'audio/ogg' :
                     'audio/mpeg'; // Default fallback

  console.log(`[Transcribe] Sending ${audioBytes.length} bytes (${audioSizeMB.toFixed(2)} MB) with Content-Type: ${contentType}`);

  // Try endpoints in order (matches Vercel implementation)
  const endpoints = [
    {
      url: 'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3',
      provider: 'hf-inference',
    },
  ];
  
  for (const endpointConfig of endpoints) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[Transcribe] Attempt ${attempt}/${retries} with ${endpointConfig.url} (provider: ${endpointConfig.provider})...`);

        // Use fetch() instead of axios - matches Vercel implementation exactly
        // fetch() doesn't add unwanted default headers like axios does
        const response = await fetch(endpointConfig.url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
            'Content-Type': contentType,
            // Note: fetch() doesn't add default Accept header, which is what we want
          },
          body: audioBytes, // Send raw bytes as Uint8Array (matches Vercel)
        });

        // Read response text (can only read once)
        const responseText = await response.text();

        // Handle 503 (model loading) - retry with longer delay
        if (response.status === 503) {
          console.log(`[Transcribe] Model is loading (503), will retry in ${10 * attempt} seconds...`);
          await new Promise(resolve => setTimeout(resolve, 10000 * attempt)); // Wait longer for model loading
          continue;
        }

        // Handle 200 (success)
        if (response.status === 200) {
          console.log(`[Transcribe] ✅ API returned 200, parsing response...`);
          
          // Parse JSON response
          let responseData;
          try {
            responseData = JSON.parse(responseText);
          } catch (parseError) {
            console.log(`[Transcribe] Response is not JSON, treating as plain text`);
            responseData = responseText;
          }

          // Extract transcript from response (handle different formats)
          let transcript = null;
          if (responseData && responseData.text) {
            transcript = responseData.text.trim();
          } else if (typeof responseData === 'string') {
            transcript = responseData.trim();
          } else if (Array.isArray(responseData) && responseData[0] && responseData[0].text) {
            transcript = responseData[0].text.trim();
          }

          if (transcript && transcript.length > 0) {
            console.log(`[Transcribe] ✅ Successfully transcribed (${transcript.length} chars)`);
            return transcript;
          } else {
            throw new Error(`Invalid response format: ${responseText.substring(0, 200)}`);
          }
        }

        // Handle 400 (bad request) - log details and fail
        if (response.status === 400) {
          const errorMsg = responseText.substring(0, 500);
          console.log(`[Transcribe] 400 Bad Request: ${errorMsg}`);
          throw new Error(`400 Bad Request: ${errorMsg}`);
        }

        // Handle 404 (not found) - try next endpoint
        if (response.status === 404) {
          console.log(`[Transcribe] 404 Not Found, trying next endpoint...`);
          continue;
        }

        // Handle 502/504 (server error) - retry with exponential backoff
        if (response.status === 502 || response.status === 504) {
          const delaySeconds = Math.min(30, 5 * Math.pow(2, attempt - 1)); // Exponential backoff: 5s, 10s, 20s (max 30s)
          console.log(`[Transcribe] ${response.status} Server Error (timeout/overload), retrying in ${delaySeconds} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
          continue;
        }

        // Handle 401/403 (auth error) - fail immediately
        if (response.status === 401 || response.status === 403) {
          const errorMsg = responseText.substring(0, 200);
          console.log(`[Transcribe] ${response.status} Auth Error: ${errorMsg}`);
          throw new Error(`${response.status} Auth Error: ${errorMsg}`);
        }

        // Other status codes
        throw new Error(`Unexpected status ${response.status}: ${responseText.substring(0, 200)}`);

      } catch (error) {
        const isLastAttempt = attempt === retries && endpointConfig === endpoints[endpoints.length - 1];
        if (isLastAttempt) {
          // Log full error details on final attempt
          console.error(`[Transcribe] Final attempt failed:`, error);
          throw error;
        }
        const errorMsg = error.message || String(error);
        console.log(`[Transcribe] Attempt ${attempt} failed: ${errorMsg}`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
      }
    }
  }

  throw new Error('All transcription attempts failed');
}

module.exports = { transcribeAudio };
