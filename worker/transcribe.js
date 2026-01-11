/**
 * Transcription module for Railway worker
 * Handles Whisper AI transcription via Hugging Face
 */

const axios = require('axios');

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const HUGGINGFACE_ENDPOINT = 'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3';

/**
 * Transcribe audio file using Hugging Face Whisper API
 */
async function transcribeAudio(audioUrl, retries = 3) {
  if (!HUGGINGFACE_API_KEY) {
    throw new Error('HUGGINGFACE_API_KEY not configured');
  }

  console.log(`[Transcribe] Starting transcription for: ${audioUrl.substring(0, 80)}...`);

  // Download audio
  const audioResponse = await axios({
    url: audioUrl,
    method: 'GET',
    responseType: 'arraybuffer',
    timeout: 300000, // 5 minutes
  });

  const audioBuffer = Buffer.from(audioResponse.data);
  const audioSizeMB = audioBuffer.length / 1024 / 1024;
  console.log(`[Transcribe] Downloaded audio: ${audioSizeMB.toFixed(2)} MB`);

  // Determine content type
  let contentType = 'audio/mpeg';
  if (audioUrl.includes('.m4a') || audioUrl.includes('.mp4')) {
    contentType = 'audio/mp4';
  } else if (audioUrl.includes('.wav')) {
    contentType = 'audio/wav';
  }

  // Try endpoints in order (router with hf-inference provider, using raw bytes like Vercel code)
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

        // Send raw audio bytes (not FormData) - matches Vercel implementation
        // Pass Buffer directly - axios accepts Buffer and will send it as raw bytes
        // when Content-Type is set to audio/* (not application/json)
        const response = await axios.post(endpointConfig.url, audioBuffer, {
          headers: {
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
            'Content-Type': contentType,
            'Accept': 'application/json', // API requires explicit Accept header (not the default "application/json, text/plain, */*")
          },
          timeout: 600000, // 10 minutes
          // Don't let axios auto-detect and convert to JSON or FormData
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        });

        // Handle different response formats
        let transcript = null;
        if (response.data && response.data.text) {
          transcript = response.data.text.trim();
        } else if (typeof response.data === 'string') {
          transcript = response.data.trim();
        } else if (response.data && Array.isArray(response.data) && response.data[0] && response.data[0].text) {
          transcript = response.data[0].text.trim();
        }

        if (transcript && transcript.length > 0) {
          console.log(`[Transcribe] ✅ Successfully transcribed (${transcript.length} chars)`);
          return transcript;
        } else {
          throw new Error('Invalid response format from Hugging Face');
        }
      } catch (error) {
        const isLastAttempt = attempt === retries && endpointConfig === endpoints[endpoints.length - 1];
        if (isLastAttempt) {
          throw error;
        }
        const statusCode = error.response?.status || 'unknown';
        const errorMsg = error.response?.data?.detail || error.response?.data?.error || error.message;
        console.log(`[Transcribe] Attempt ${attempt} failed: ${errorMsg} (status: ${statusCode})`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
      }
    }
  }

  throw new Error('All transcription attempts failed');
}

module.exports = { transcribeAudio };
