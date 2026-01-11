# Audio Preprocessing for Large Files

## Problem

Hugging Face shared inference infrastructure has limitations:
- Files >25MB often cause 502 errors (server timeouts)
- 90-minute sermons are typically 60-80MB (M4A format)
- Free tier shared infrastructure struggles with large files
- Base64 encoding adds 33% overhead (makes large files worse, not better)

## Current Behavior

The system now **rejects files >25MB** with a clear error message explaining why and what to do.

**Base64 fallback is disabled for files >10MB** (counterproductive - adds overhead without helping).

## Solutions

### Option 1: Audio Chunking (Recommended for 90-minute sermons)

**Why it works:**
- Each chunk is small enough to not 502 (<10MB per chunk)
- If one chunk fails, you retry just that chunk
- You can show progress ("Chunk 3/9 done")
- Deterministic and reliable

**Implementation:**
1. Download the full M4A file
2. Transcode + split into 10-minute chunks using ffmpeg
3. Send each chunk to Whisper sequentially
4. Join the transcripts in order
5. Cache final transcript

**Requirements:**
- Preprocessing worker service (Railway/Render/Fly/VPS)
- ffmpeg installed
- Storage for chunk files (Supabase Storage or worker's filesystem)

**Architecture:**
```
Vercel App → Worker Service → ffmpeg (chunk) → Storage
         ↓
    Whisper API (per chunk) → Merge transcripts → Store
```

**Worker API endpoint:**
```
POST /chunk
Body: { audioUrl: string }
Response: { chunkUrls: string[], duration: number, chunkCount: number }
```

### Option 2: Audio Compression

Convert large M4A files to smaller MP3 format:

**Target format:**
- **MP3 16kHz mono 64kbps**
- Reduces 62MB → 10-15MB (typically 70-80% smaller)
- Still high quality for speech transcription

**Tools:**
- `ffmpeg` (command line)
- Online converters
- Audio editing software

**Example ffmpeg command:**
```bash
ffmpeg -i input.m4a -ar 16000 -ac 1 -b:a 64k output.mp3
```

### Option 3: Preprocessing Worker (Recommended Implementation)

Add a small service (Railway/Render/Fly) to handle preprocessing:

**Responsibilities:**
1. Download Podbean audio
2. Chunk using ffmpeg (10-minute segments)
3. Optionally: Compress chunks to MP3 16kHz mono 64kbps
4. Upload chunks to storage (Supabase Storage or return URLs)
5. Return chunk URLs/metadata

**Benefits:**
- Automatic preprocessing
- No manual steps
- Works for all sermons
- Handles 90-minute sermons reliably

**Worker Service Options:**
- **Railway**: Easy deployment, $5/month, Docker support
- **Render**: Free tier available, easy setup
- **Fly.io**: Free tier, Docker support
- **VPS**: $5/month (DigitalOcean, Linode, etc.), full control

### Option 4: Paid Transcription Services

Use services that handle large files better:
- **OpenAI Whisper API**: $0.006/minute, handles large files well
- **AssemblyAI**: $0.00025/second, robust large file support
- **Deepgram**: $0.0043/minute, fast and reliable

**Tradeoffs:**
- Cost: ~$0.54 for 90-minute sermon (OpenAI)
- Reliability: Better than free tier
- No preprocessing needed

## Implementation Priority

1. **Short term**: Size guardrail (✅ done) - clear errors prevent wasted attempts
2. **Medium term**: Preprocessing worker - automatic compression/chunking
3. **Long term**: Consider paid service for reliability at scale

## Current Limits

- **Max file size**: 25MB (configurable in `lib/transcribeWithWhisper.ts`)
- **Recommended**: <15MB for reliable transcription
- **Typical 90-min sermon**: 60-80MB (needs compression/chunking)
