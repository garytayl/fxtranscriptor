/**
 * Audio Chunking Worker Service
 * 
 * Handles audio chunking for large files (>20MB) before transcription.
 * 
 * Responsibilities:
 * 1. Download audio from URL
 * 2. Transcode to MP3 mono 16kHz 64kbps (compression)
 * 3. Split into 10-minute chunks using ffmpeg
 * 4. Upload chunks to Supabase Storage
 * 5. Return chunk URLs
 */

const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const ytdl = require('ytdl-core');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'sermon-chunks';

// Debug: Log environment variable status (without exposing secrets)
console.log(`[Worker] Environment check:`);
console.log(`[Worker]   SUPABASE_URL: ${SUPABASE_URL ? 'SET (' + SUPABASE_URL.substring(0, 30) + '...)' : 'NOT SET'}`);
console.log(`[Worker]   SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY ? 'SET (' + SUPABASE_SERVICE_KEY.substring(0, 20) + '...)' : 'NOT SET'}`);
console.log(`[Worker]   SUPABASE_STORAGE_BUCKET: ${STORAGE_BUCKET}`);

// Initialize Supabase client (if configured)
let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  console.log(`[Worker] ✅ Supabase Storage configured: ${STORAGE_BUCKET}`);
} else {
  console.warn('[Worker] ⚠️  Supabase Storage not configured - chunks will be stored locally (not recommended for production)');
  if (!SUPABASE_URL) console.warn('[Worker]   Missing: SUPABASE_URL');
  if (!SUPABASE_SERVICE_KEY) console.warn('[Worker]   Missing: SUPABASE_SERVICE_KEY');
}

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
  
  // Handle youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  
  // Handle youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  
  return null;
}

/**
 * Download audio from YouTube using ytdl-core
 */
async function downloadYouTubeAudio(youtubeUrl, tempDir) {
  const videoId = extractYouTubeVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error(`Invalid YouTube URL: ${youtubeUrl}`);
  }

  console.log(`[Worker] Extracting audio from YouTube video: ${videoId}`);
  
  // Validate URL first
  const isValid = await ytdl.validateURL(youtubeUrl);
  if (!isValid) {
    throw new Error(`Invalid YouTube URL or video not available: ${youtubeUrl}`);
  }

  const tempFile = path.join(tempDir, `youtube_${videoId}_${uuidv4()}.m4a`);
  const writer = require('fs').createWriteStream(tempFile);

  return new Promise((resolve, reject) => {
    // Get audio stream (best quality audio only)
    const stream = ytdl(youtubeUrl, {
      quality: 'highestaudio',
      filter: 'audioonly',
    });

    stream.on('info', (info) => {
      console.log(`[Worker] YouTube video info: ${info.videoDetails.title.substring(0, 60)}...`);
      console.log(`[Worker] Duration: ${info.videoDetails.lengthSeconds}s`);
    });

    stream.on('error', (error) => {
      console.error(`[Worker] YouTube download error:`, error);
      reject(new Error(`Failed to download YouTube audio: ${error.message}`));
    });

    stream.pipe(writer);

    writer.on('finish', () => {
      console.log(`[Worker] YouTube audio extracted: ${tempFile}`);
      resolve(tempFile);
    });

    writer.on('error', (error) => {
      console.error(`[Worker] File write error:`, error);
      reject(new Error(`Failed to save YouTube audio: ${error.message}`));
    });
  });
}

/**
 * Download audio file to temporary location
 * Handles both direct audio URLs (Podbean) and YouTube URLs
 */
async function downloadAudio(audioUrl, tempDir) {
  console.log(`[Worker] Downloading audio: ${audioUrl.substring(0, 100)}...`);
  
  // Check if it's a YouTube URL
  if (isYouTubeUrl(audioUrl)) {
    return await downloadYouTubeAudio(audioUrl, tempDir);
  }
  
  // Otherwise, download as direct audio URL (Podbean, etc.)
  const response = await axios({
    url: audioUrl,
    method: 'GET',
    responseType: 'stream',
    timeout: 300000, // 5 minutes
  });

  const tempFile = path.join(tempDir, `input_${uuidv4()}.m4a`);
  const writer = require('fs').createWriteStream(tempFile);
  
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      console.log(`[Worker] Audio downloaded: ${tempFile}`);
      resolve(tempFile);
    });
    writer.on('error', reject);
  });
}

/**
 * Transcode and chunk audio using ffmpeg
 */
function chunkAudio(inputFile, outputDir, chunkDuration = 600) {
  return new Promise((resolve, reject) => {
    console.log(`[Worker] Starting audio chunking (${chunkDuration}s chunks)...`);
    
    const outputPattern = path.join(outputDir, 'chunk_%03d.mp3');
    let chunkFiles = [];

    ffmpeg(inputFile)
      .audioCodec('libmp3lame')
      .audioBitrate(64)
      .audioFrequency(16000)
      .audioChannels(1)
      .outputOptions([
        '-f', 'segment',
        '-segment_time', chunkDuration.toString(),
        '-segment_format', 'mp3',
        '-reset_timestamps', '1',
      ])
      .output(outputPattern)
      .on('start', (commandLine) => {
        console.log(`[Worker] FFmpeg command: ${commandLine}`);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`[Worker] Chunking progress: ${progress.percent.toFixed(1)}%`);
        }
      })
      .on('end', async () => {
        try {
          // Find all generated chunk files
          const files = await fs.readdir(outputDir);
          chunkFiles = files
            .filter(f => f.startsWith('chunk_') && f.endsWith('.mp3'))
            .sort()
            .map((file, index) => ({
              file: path.join(outputDir, file),
              index: index,
            }));

          console.log(`[Worker] ✅ Chunking complete: ${chunkFiles.length} chunks created`);
          resolve(chunkFiles);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', (error) => {
        console.error(`[Worker] FFmpeg error:`, error);
        reject(error);
      })
      .run();
  });
}

/**
 * Upload chunk to Supabase Storage
 */
async function uploadChunk(chunkFile, chunkIndex) {
  if (!supabase) {
    // Return local file path if Supabase not configured (dev mode)
    return `file://${chunkFile}`;
  }

  const fileName = `chunk_${String(chunkIndex).padStart(3, '0')}_${uuidv4()}.mp3`;
  const fileBuffer = await fs.readFile(chunkFile);

  console.log(`[Worker] Uploading chunk ${chunkIndex} to Supabase Storage: ${fileName}`);

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, fileBuffer, {
      contentType: 'audio/mpeg',
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload chunk ${chunkIndex}: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName);

  console.log(`[Worker] ✅ Chunk ${chunkIndex} uploaded: ${urlData.publicUrl}`);
  return urlData.publicUrl;
}

/**
 * Get audio duration using ffprobe
 */
function getAudioDuration(audioFile) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioFile, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const duration = metadata.format.duration || 0;
        resolve(duration);
      }
    });
  });
}

/**
 * Clean up temporary files
 */
async function cleanup(files) {
  for (const file of files) {
    try {
      await fs.unlink(file);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

/**
 * POST /chunk
 * 
 * Chunks audio file into 10-minute segments
 */
app.post('/chunk', async (req, res) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chunk-'));
  const tempFiles = [tempDir];

  try {
    const { audioUrl } = req.body;

    if (!audioUrl || typeof audioUrl !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid audioUrl parameter',
        chunks: [],
      });
    }

    console.log(`[Worker] Chunking request received for: ${audioUrl.substring(0, 100)}...`);

    // Step 1: Download audio
    const inputFile = await downloadAudio(audioUrl, tempDir);
    tempFiles.push(inputFile);

    // Step 2: Get audio duration
    const duration = await getAudioDuration(inputFile);
    console.log(`[Worker] Audio duration: ${duration.toFixed(1)}s (${(duration / 60).toFixed(1)} minutes)`);

    // Step 3: Chunk audio (10-minute chunks = 600 seconds)
    const chunkFiles = await chunkAudio(inputFile, tempDir, 600);
    tempFiles.push(...chunkFiles.map(cf => cf.file));

    // Step 4: Upload chunks to Supabase Storage
    const chunks = [];
    for (const chunkFile of chunkFiles) {
      const chunkUrl = await uploadChunk(chunkFile.file, chunkFile.index);
      chunks.push({
        url: chunkUrl,
        index: chunkFile.index,
        duration: 600, // 10 minutes
        startTime: chunkFile.index * 600,
      });
    }

    // Sort chunks by index
    chunks.sort((a, b) => a.index - b.index);

    console.log(`[Worker] ✅ Chunking complete: ${chunks.length} chunks uploaded`);

    res.json({
      success: true,
      chunks: chunks,
      totalDuration: duration,
      chunkCount: chunks.length,
    });

  } catch (error) {
    console.error('[Worker] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      chunks: [],
    });
  } finally {
    // Cleanup temporary files
    try {
      for (const file of tempFiles.reverse()) {
        try {
          if ((await fs.stat(file)).isDirectory()) {
            const files = await fs.readdir(file);
            for (const f of files) {
              await fs.unlink(path.join(file, f));
            }
            await fs.rmdir(file);
          } else {
            await fs.unlink(file);
          }
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    } catch (err) {
      // Ignore cleanup errors
    }
  }
});

/**
 * POST /transcribe
 * 
 * Full transcription pipeline:
 * 1. Download audio (or use provided chunks)
 * 2. Chunk if needed (>20MB)
 * 3. Transcribe each chunk
 * 4. Concatenate transcripts
 * 5. Update Supabase database
 */
const { transcribeAudio } = require('./transcribe');

app.post('/transcribe', async (req, res) => {
  try {
    const { sermonId, audioUrl } = req.body;

    if (!sermonId || !audioUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing sermonId or audioUrl',
      });
    }

    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Supabase not configured',
      });
    }

    console.log(`[Worker] Transcription request for sermon ${sermonId}`);

    // Update status to generating
    await supabase
      .from('sermons')
      .update({ 
        status: 'generating',
        progress_json: { step: 'downloading', message: 'Downloading audio file...' }
      })
      .eq('id', sermonId);

    // Check file size (skip for YouTube URLs - will check after extraction)
    let fileSizeMB = 0;
    if (!isYouTubeUrl(audioUrl)) {
      try {
        const headResponse = await axios.head(audioUrl, { timeout: 10000 });
        const contentLength = headResponse.headers['content-length'];
        if (contentLength) {
          fileSizeMB = parseInt(contentLength) / 1024 / 1024;
          console.log(`[Worker] Audio file size: ${fileSizeMB.toFixed(2)} MB`);
        }
      } catch (error) {
        console.log(`[Worker] Could not determine file size, proceeding...`);
      }
    } else {
      console.log(`[Worker] YouTube URL detected - will check size after audio extraction`);
    }

    let transcript = '';

    // If file is large, chunk it first
    if (fileSizeMB > 20) {
      console.log(`[Worker] File is large (${fileSizeMB.toFixed(2)} MB), chunking first...`);
      
      await supabase
        .from('sermons')
        .update({ 
          progress_json: { step: 'chunking', message: 'Chunking audio into 10-minute segments...' }
        })
        .eq('id', sermonId);

      // Chunk the audio
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'transcribe-'));
      const inputFile = await downloadAudio(audioUrl, tempDir);
      const chunkFiles = await chunkAudio(inputFile, tempDir, 600);
      
      // Upload chunks
      const chunks = [];
      for (const chunkFile of chunkFiles) {
        const chunkUrl = await uploadChunk(chunkFile.file, chunkFile.index);
        chunks.push(chunkUrl);
      }

      console.log(`[Worker] ✅ Chunked into ${chunks.length} chunks, starting transcription...`);

      // Transcribe each chunk
      const transcripts = [];
      for (let i = 0; i < chunks.length; i++) {
        await supabase
          .from('sermons')
          .update({ 
            progress_json: { 
              step: 'transcribing',
              current: i + 1,
              total: chunks.length,
              message: `Transcribing chunk ${i + 1} of ${chunks.length}...`
            }
          })
          .eq('id', sermonId);

        console.log(`[Worker] Transcribing chunk ${i + 1}/${chunks.length}...`);
        const chunkTranscript = await transcribeAudio(chunks[i]);
        transcripts.push(chunkTranscript);
      }
      
      // Update progress before combining
      await supabase
        .from('sermons')
        .update({ 
          progress_json: { 
            step: 'combining',
            message: 'Combining transcripts from all chunks...'
          }
        })
        .eq('id', sermonId);

      transcript = transcripts.join('\n\n');
    } else {
      // Small file, transcribe directly
      await supabase
        .from('sermons')
        .update({ 
          progress_json: { step: 'transcribing', message: 'Transcribing audio with Whisper AI...' }
        })
        .eq('id', sermonId);

      transcript = await transcribeAudio(audioUrl);
    }
    
    // Final step before saving
    await supabase
      .from('sermons')
      .update({ 
        progress_json: { step: 'saving', message: 'Saving transcript to database...' }
      })
      .eq('id', sermonId);

    // Update database with transcript
    await supabase
      .from('sermons')
      .update({
        transcript: transcript,
        status: 'completed',
        progress_json: null,
      })
      .eq('id', sermonId);

    console.log(`[Worker] ✅ Transcription complete for sermon ${sermonId} (${transcript.length} chars)`);

    res.json({
      success: true,
      transcript: transcript,
      sermonId: sermonId,
    });

  } catch (error) {
    console.error('[Worker] Transcription error:', error);
    
    // Update database with error
    if (supabase && req.body.sermonId) {
      await supabase
        .from('sermons')
        .update({
          status: 'failed',
          error_message: error.message,
          progress_json: null,
        })
        .eq('id', req.body.sermonId);
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'audio-chunking-worker' });
});

app.listen(PORT, () => {
  console.log(`[Worker] Audio chunking worker service listening on port ${PORT}`);
  console.log(`[Worker] Environment: ${process.env.NODE_ENV || 'development'}`);
  if (!supabase) {
    console.warn('[Worker] WARNING: Supabase Storage not configured - chunks will be stored locally');
  }
});
