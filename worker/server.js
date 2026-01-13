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
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
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
 * Download audio from YouTube using yt-dlp (more reliable, handles bot detection better)
 */
async function downloadYouTubeAudio(youtubeUrl, tempDir) {
  const videoId = extractYouTubeVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error(`Invalid YouTube URL: ${youtubeUrl}`);
  }

  console.log(`[Worker] Extracting audio from YouTube video: ${videoId} using yt-dlp`);
  
  const tempFile = path.join(tempDir, `youtube_${videoId}_${uuidv4()}.m4a`);

  try {
    // Use yt-dlp to download audio (handles bot detection much better)
    // -x: extract audio only
    // --audio-format m4a: output as m4a
    // --audio-quality 0: best quality
    // -o: output file
    const command = `yt-dlp -x --audio-format m4a --audio-quality 0 -o "${tempFile}" "${youtubeUrl}"`;
    
    console.log(`[Worker] Running: yt-dlp for video ${videoId}`);
    const { stdout, stderr } = await execAsync(command, {
      timeout: 600000, // 10 minutes timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    if (stderr && !stderr.includes('[download]')) {
      console.warn(`[Worker] yt-dlp warnings: ${stderr}`);
    }

    // Check if file was created
    try {
      await fs.access(tempFile);
      console.log(`[Worker] ✅ YouTube audio extracted: ${tempFile}`);
      return tempFile;
    } catch (error) {
      throw new Error(`Audio file was not created: ${tempFile}`);
    }
  } catch (error) {
    console.error(`[Worker] yt-dlp error:`, error);
    let errorMessage = `Failed to download YouTube audio: ${error.message}`;
    
    if (error.message.includes('Sign in to confirm') || error.message.includes('bot')) {
      errorMessage = `YouTube bot detection: ${error.message}. yt-dlp should handle this better, but YouTube may be blocking automated access.`;
    }
    
    throw new Error(errorMessage);
  }
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

    // Helper function to check if transcription was cancelled
    const checkCancelled = async () => {
      const { data: sermon } = await supabase
        .from('sermons')
        .select('status, progress_json')
        .eq('id', sermonId)
        .single();
      
      // Check if status changed from generating (cancelled)
      if (sermon && sermon.status !== 'generating') {
        console.log(`[Worker] Transcription cancelled (status: ${sermon.status})`);
        return true;
      }
      
      // Check if progress_json indicates cancellation
      if (sermon?.progress_json?.step === 'cancelled') {
        console.log(`[Worker] Transcription cancelled (step: cancelled)`);
        return true;
      }
      
      return false;
    };

    // Download audio first to check size (needed for YouTube URLs)
    let fileSizeMB = 0;
    let tempDir = null;
    let inputFile = null;
    
    if (isYouTubeUrl(audioUrl)) {
      console.log(`[Worker] YouTube URL detected - downloading audio to check size...`);
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'transcribe-'));
      inputFile = await downloadAudio(audioUrl, tempDir);
      
      // Check if cancelled during download
      if (await checkCancelled()) {
        console.log(`[Worker] Cancelled during YouTube download, cleaning up...`);
        // Cleanup
        if (tempDir) {
          try {
            const files = await fs.readdir(tempDir);
            for (const file of files) {
              await fs.unlink(path.join(tempDir, file)).catch(() => {});
            }
            await fs.rmdir(tempDir).catch(() => {});
          } catch (err) {}
        }
        return res.status(200).json({ success: false, cancelled: true, message: 'Transcription cancelled' });
      }
      
      // Get file size
      const stats = await fs.stat(inputFile);
      fileSizeMB = stats.size / 1024 / 1024;
      console.log(`[Worker] YouTube audio extracted: ${fileSizeMB.toFixed(2)} MB`);
    } else {
      // For direct URLs, try to get size from headers
      try {
        const headResponse = await axios.head(audioUrl, { timeout: 10000 });
        const contentLength = headResponse.headers['content-length'];
        if (contentLength) {
          fileSizeMB = parseInt(contentLength) / 1024 / 1024;
          console.log(`[Worker] Audio file size: ${fileSizeMB.toFixed(2)} MB`);
        }
      } catch (error) {
        console.log(`[Worker] Could not determine file size, will download to check...`);
      }
    }

    let transcript = '';
    const CHUNKING_THRESHOLD_MB = 20;

    // If file is large, chunk it first
    if (fileSizeMB > CHUNKING_THRESHOLD_MB) {
      console.log(`[Worker] File is large (${fileSizeMB.toFixed(2)} MB), chunking first...`);
      
      await supabase
        .from('sermons')
        .update({ 
          progress_json: { step: 'chunking', message: 'Chunking audio into 10-minute segments...' }
        })
        .eq('id', sermonId);

      // If we haven't downloaded yet (non-YouTube URL), download now
      if (!inputFile) {
        if (!tempDir) {
          tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'transcribe-'));
        }
        inputFile = await downloadAudio(audioUrl, tempDir);
      }
      
      const chunkFiles = await chunkAudio(inputFile, tempDir, 600);
      
      // Upload chunks
      const chunks = [];
      for (const chunkFile of chunkFiles) {
        const chunkUrl = await uploadChunk(chunkFile.file, chunkFile.index);
        chunks.push(chunkUrl);
      }

      console.log(`[Worker] ✅ Chunked into ${chunks.length} chunks, starting transcription...`);

      // Check for existing progress (resume from last completed chunk)
      const { data: currentSermon } = await supabase
        .from('sermons')
        .select('progress_json')
        .eq('id', sermonId)
        .single();
      
      const existingProgress = currentSermon?.progress_json || {};
      const completedChunks = existingProgress.completedChunks || {};
      const failedChunks = existingProgress.failedChunks || {};
      
      // Find chunks that need transcription:
      // 1. Chunks that failed (retry them)
      // 2. Chunks that haven't been started yet
      const failedIndices = Object.keys(failedChunks).map(Number);
      const completedIndices = Object.keys(completedChunks).map(Number);
      const allCompletedIndices = new Set([...completedIndices]);
      
      if (completedIndices.length > 0 || failedIndices.length > 0) {
        console.log(`[Worker] Resuming transcription:`);
        console.log(`[Worker]   - ${completedIndices.length} chunks already completed: [${completedIndices.sort((a,b) => a-b).join(', ')}]`);
        if (failedIndices.length > 0) {
          console.log(`[Worker]   - ${failedIndices.length} chunks to retry: [${failedIndices.sort((a,b) => a-b).join(', ')}]`);
        }
      }

      // Transcribe each chunk - skip only if successfully completed
      for (let i = 0; i < chunks.length; i++) {
        // Check if cancelled before processing each chunk
        if (await checkCancelled()) {
          console.log(`[Worker] Cancelled before chunk ${i + 1}, stopping transcription...`);
          // Cleanup temp files
          if (tempDir) {
            try {
              const files = await fs.readdir(tempDir);
              for (const file of files) {
                await fs.unlink(path.join(tempDir, file)).catch(() => {});
              }
              await fs.rmdir(tempDir).catch(() => {});
            } catch (err) {}
          }
          return res.status(200).json({ success: false, cancelled: true, message: 'Transcription cancelled', completedChunks: Object.keys(completedChunks).length });
        }
        
        // Skip if already successfully completed
        if (completedChunks[i]) {
          console.log(`[Worker] Chunk ${i + 1}/${chunks.length} already completed, skipping...`);
          continue;
        }
        
        // Retry failed chunks or transcribe new ones
        if (failedChunks[i]) {
          console.log(`[Worker] Retrying failed chunk ${i + 1}/${chunks.length}...`);
        }

        await supabase
          .from('sermons')
          .update({ 
            progress_json: { 
              step: 'transcribing',
              current: i + 1,
              total: chunks.length,
              message: `Transcribing chunk ${i + 1} of ${chunks.length}...`,
              completedChunks: completedChunks, // Preserve existing chunks
            }
          })
          .eq('id', sermonId);

        console.log(`[Worker] Transcribing chunk ${i + 1}/${chunks.length}...`);
        
        // Add delay between chunks to avoid rate limiting (except for first chunk)
        // Hugging Face free tier can be slow, so we add delays to avoid overwhelming it
        if (i > 0) {
          const delaySeconds = 5; // 5 second delay between chunks
          console.log(`[Worker] Waiting ${delaySeconds} seconds before next chunk to avoid rate limits...`);
          await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
        }
        
        try {
          const chunkTranscript = await transcribeAudio(chunks[i]);
          
          // Check if cancelled after transcription
          if (await checkCancelled()) {
            console.log(`[Worker] Cancelled after chunk ${i + 1}, stopping transcription...`);
            // Save the chunk we just completed before stopping
            completedChunks[i] = chunkTranscript;
            await supabase
              .from('sermons')
              .update({ 
                progress_json: { 
                  step: 'cancelled',
                  current: i + 1,
                  total: chunks.length,
                  message: `Transcription cancelled. ${Object.keys(completedChunks).length} chunks completed.`,
                  completedChunks: completedChunks,
                }
              })
              .eq('id', sermonId);
            // Cleanup temp files
            if (tempDir) {
              try {
                const files = await fs.readdir(tempDir);
                for (const file of files) {
                  await fs.unlink(path.join(tempDir, file)).catch(() => {});
                }
                await fs.rmdir(tempDir).catch(() => {});
              } catch (err) {}
            }
            return res.status(200).json({ success: false, cancelled: true, message: 'Transcription cancelled', completedChunks: Object.keys(completedChunks).length });
          }
          
          // Save this chunk immediately so we don't lose progress
          completedChunks[i] = chunkTranscript;
          await supabase
            .from('sermons')
            .update({ 
              progress_json: { 
                step: 'transcribing',
                current: i + 1,
                total: chunks.length,
                message: `Chunk ${i + 1}/${chunks.length} completed. ${chunks.length - (i + 1)} remaining...`,
                completedChunks: completedChunks,
              }
            })
            .eq('id', sermonId);
          
          console.log(`[Worker] ✅ Chunk ${i + 1}/${chunks.length} saved (${chunkTranscript.length} chars)`);
        } catch (error) {
          console.error(`[Worker] ❌ Chunk ${i + 1}/${chunks.length} failed:`, error.message);
          
          // Save error but continue with next chunk
          await supabase
            .from('sermons')
            .update({ 
              progress_json: { 
                step: 'transcribing',
                current: i + 1,
                total: chunks.length,
                message: `Chunk ${i + 1}/${chunks.length} failed: ${error.message}. Continuing with remaining chunks...`,
                completedChunks: completedChunks,
                failedChunks: { ...(existingProgress.failedChunks || {}), [i]: error.message },
              }
            })
            .eq('id', sermonId);
        }
      }
      
      // Reconstruct full transcripts array from completedChunks (in case we resumed)
      // This ensures we have all chunks in order, including ones completed in previous runs
      const allTranscripts = [];
      for (let i = 0; i < chunks.length; i++) {
        if (completedChunks[i]) {
          allTranscripts.push(completedChunks[i]);
        } else {
          // This chunk failed or wasn't completed - add empty string to maintain order
          allTranscripts.push('');
        }
      }
      
      // Filter out empty strings (failed chunks) and combine
      const validTranscripts = allTranscripts.filter(t => t && t.length > 0);
      
      if (validTranscripts.length === 0) {
        throw new Error('All chunks failed to transcribe. Please try again later.');
      }
      
      if (validTranscripts.length < chunks.length) {
        const failedCount = chunks.length - validTranscripts.length;
        console.log(`[Worker] ⚠️  Only ${validTranscripts.length}/${chunks.length} chunks succeeded. ${failedCount} chunks failed. Combining available chunks...`);
      }
      
      // Update progress before combining
      await supabase
        .from('sermons')
        .update({ 
          progress_json: { 
            step: 'combining',
            message: `Combining ${validTranscripts.length}/${chunks.length} completed chunks...`,
            completedChunks: completedChunks,
          }
        })
        .eq('id', sermonId);

      transcript = validTranscripts.join('\n\n');
      
      // Cleanup temp directory
      if (tempDir) {
        try {
          const files = await fs.readdir(tempDir);
          for (const file of files) {
            await fs.unlink(path.join(tempDir, file)).catch(() => {});
          }
          await fs.rmdir(tempDir).catch(() => {});
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }
    } else {
      // Small file, transcribe directly
      await supabase
        .from('sermons')
        .update({ 
          progress_json: { step: 'transcribing', message: 'Transcribing audio with Whisper AI...' }
        })
        .eq('id', sermonId);

      // If we downloaded for size check, use the file; otherwise use URL
      if (inputFile && isYouTubeUrl(audioUrl)) {
        // For YouTube, we already have the file, but transcribeAudio expects a URL
        // We need to upload it first or modify transcribeAudio to accept a buffer
        // For now, let's upload it to storage and use that URL
        const uploadedUrl = await uploadChunk(inputFile, 0);
        transcript = await transcribeAudio(uploadedUrl);
        
        // Cleanup
        if (tempDir) {
          try {
            await fs.unlink(inputFile).catch(() => {});
            await fs.rmdir(tempDir).catch(() => {});
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
        }
      } else {
        transcript = await transcribeAudio(audioUrl);
      }
    }
    
    // Validate transcript quality before saving
    const transcriptTrimmed = transcript.trim();
    if (!transcriptTrimmed || transcriptTrimmed.length < 50) {
      throw new Error(`Transcript too short (${transcriptTrimmed.length} chars). Audio may be corrupted or silent.`);
    }
    
    // Check for repetitive patterns (like "avgjord avgjord..." which indicates bad transcription)
    const words = transcriptTrimmed.toLowerCase().split(/\s+/);
    if (words.length > 10) {
      // Check if more than 50% of words are the same (indicates repetition/hallucination)
      const wordCounts = {};
      words.forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      });
      const maxCount = Math.max(...Object.values(wordCounts));
      const repetitionRatio = maxCount / words.length;
      
      if (repetitionRatio > 0.5) {
        const repeatedWord = Object.keys(wordCounts).find(w => wordCounts[w] === maxCount);
        throw new Error(`Transcript appears to be corrupted (repetitive pattern detected: "${repeatedWord}" repeated ${maxCount} times). This usually indicates audio quality issues or transcription errors.`);
      }
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
// Health check endpoints for Railway/container orchestration
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'audio-chunking-worker',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Root endpoint for basic health checks
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'audio-chunking-worker',
    endpoints: ['/health', '/chunk', '/transcribe'],
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Worker] Audio chunking worker service listening on port ${PORT}`);
  console.log(`[Worker] Environment: ${process.env.NODE_ENV || 'development'}`);
  if (!supabase) {
    console.warn('[Worker] WARNING: Supabase Storage not configured - chunks will be stored locally');
  }
});
