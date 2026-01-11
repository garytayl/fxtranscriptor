# Audio Preprocessing for Large Files

## Problem

Hugging Face shared inference infrastructure has limitations:
- Files >25MB often cause 502 errors (server timeouts)
- 90-minute sermons are typically 60-80MB (M4A format)
- Free tier shared infrastructure struggles with large files

## Current Behavior

The system now **rejects files >25MB** with a clear error message explaining why and what to do.

## Solutions

### Option 1: Audio Compression (Recommended)

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

### Option 2: Audio Chunking

Split long sermons into ~10 minute segments:
- Each segment ~10MB (within limits)
- Transcribe separately
- Combine transcripts

**Example ffmpeg command:**
```bash
# Split into 10-minute chunks
ffmpeg -i input.m4a -f segment -segment_time 600 -c copy output_%03d.m4a
```

### Option 3: Preprocessing Worker

Add a small service (Railway/Render/Fly) to handle preprocessing:

**Responsibilities:**
1. Download Podbean audio
2. Compress/chunk using ffmpeg
3. Return smaller file or upload to storage
4. Vercel app sends compressed file to Hugging Face

**Benefits:**
- Automatic preprocessing
- No manual steps
- Works for all sermons

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
