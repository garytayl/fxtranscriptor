# YouTube Audio Extraction for Transcription

## Overview

The system now supports transcribing YouTube videos by extracting audio directly from YouTube URLs. This works seamlessly with the existing Railway worker service.

## How It Works

### Flow

1. **User clicks "Generate Transcript"** on a sermon with only a YouTube URL (no `audio_url`)
2. **Vercel app** checks if `AUDIO_WORKER_URL` is configured
3. **If worker is available**: Sends YouTube URL to worker's `/transcribe` endpoint
4. **Worker extracts audio** from YouTube using `ytdl-core`
5. **Worker transcribes** using Hugging Face Whisper AI
6. **Worker saves transcript** to database

### Priority Order

1. **Podbean audio URL** (if available) - Direct MP3/M4A download
2. **YouTube URL** (if no audio_url) - Audio extraction via worker
3. **Error** (if neither available)

## Setup

### 1. Install ytdl-core in Worker

The worker's `package.json` already includes `ytdl-core`. After deploying:

```bash
cd worker
npm install
```

Or Railway will auto-install on deploy.

### 2. Ensure Worker is Deployed

Make sure your Railway worker is running and `AUDIO_WORKER_URL` is set in Vercel.

### 3. Test

Try generating a transcript for a sermon that only has a YouTube URL (no Podbean match).

## Technical Details

### Worker Changes

**`worker/server.js`**:
- Added `downloadYouTubeAudio()` function using `ytdl-core`
- Updated `downloadAudio()` to detect YouTube URLs and extract audio
- Handles both direct audio URLs (Podbean) and YouTube URLs

**`worker/transcribe.js`**:
- Updated `transcribeAudio()` to handle YouTube URLs
- Extracts audio from YouTube before transcription
- Falls back to direct download for Podbean URLs

### Vercel App Changes

**`app/api/catalog/generate/route.ts`**:
- Checks for `audio_url` first (Podbean)
- Falls back to `youtube_url` if no `audio_url`
- Sends YouTube URL to worker when worker is configured
- Shows helpful error if worker not configured

## Benefits

✅ **Works for YouTube-only sermons** - No need to match with Podbean
✅ **Uses existing infrastructure** - Leverages Railway worker you already have
✅ **Handles large files** - Worker can chunk YouTube audio just like Podbean audio
✅ **Automatic** - No manual audio URL setting needed

## Limitations

⚠️ **Requires worker service** - YouTube extraction only works if `AUDIO_WORKER_URL` is set
⚠️ **YouTube ToS** - Automated downloading may violate YouTube's terms (use responsibly)
⚠️ **Rate limits** - YouTube may rate limit if extracting too many videos quickly

## Example

**Before**:
- Sermon has only `youtube_url`
- Transcription fails: "No audio_url available"

**After**:
- Sermon has only `youtube_url`
- Worker extracts audio from YouTube
- Transcription succeeds ✅

## Troubleshooting

### "YouTube audio extraction requires the worker service"

**Fix**: Set `AUDIO_WORKER_URL` in Vercel environment variables pointing to your Railway worker.

### "Failed to download YouTube audio"

**Possible causes**:
- Video is private/unavailable
- YouTube rate limiting
- Network issues

**Fix**: Try again later, or match sermon with Podbean episode to get direct audio URL.

### Worker fails to extract audio

**Check worker logs** for:
- `ytdl-core` installation errors
- YouTube URL validation errors
- Network timeouts

**Fix**: Ensure `ytdl-core` is installed in worker (`npm install` in worker directory).
