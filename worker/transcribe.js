/**
 * Transcription module for Railway worker
 * Handles Whisper AI transcription via Hugging Face
 */

const axios = require('axios');
const FormData = require('form-data');

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

  // Try endpoints in order (direct inference API, then router with different providers)
  const endpoints = [
    'https://api-inference.huggingface.co/models/openai/whisper-large-v3',
    'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3',
  ];
  
  for (const endpoint of endpoints) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[Transcribe] Attempt ${attempt}/${retries} with ${endpoint}...`);

        const formData = new FormData();
        formData.append('inputs', audioBuffer, {
          filename: 'audio.mp3',
          contentType: contentType,
        });

        const response = await axios.post(endpoint, formData, {
          headers: {
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
            ...formData.getHeaders(),
          },
          timeout: 600000, // 10 minutes
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
        const isLastAttempt = attempt === retries && endpoint === endpoints[endpoints.length - 1];
        if (isLastAttempt) {
          throw error;
        }
        const statusCode = error.response?.status || 'unknown';
        console.log(`[Transcribe] Attempt ${attempt} failed: ${error.message} (status: ${statusCode})`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
      }
    }
  }

  throw new Error('All transcription attempts failed');
}

module.exports = { transcribeAudio };
