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

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'sermon-chunks';

// Initialize Supabase client (if configured)
let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  console.log(`[Worker] Supabase Storage configured: ${STORAGE_BUCKET}`);
} else {
  console.warn('[Worker] Supabase Storage not configured - chunks will be stored locally (not recommended for production)');
}

/**
 * Download audio file to temporary location
 */
async function downloadAudio(audioUrl, tempDir) {
  console.log(`[Worker] Downloading audio: ${audioUrl.substring(0, 100)}...`);
  
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
    let currentChunkIndex = 0;

    ffmpeg(inputFile)
      .audioCodec('libmp3lame')
      .audioBitrate(64)
      .audioFrequency(16000)
      .audioChannels(1)
      .format('segment')
      .segmentTime(chunkDuration)
      .outputOptions([
        '-reset_timestamps', '1',
        '-segment_format', 'mp3',
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
