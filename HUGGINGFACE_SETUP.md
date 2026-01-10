# Hugging Face Whisper AI Setup Guide

This guide will help you set up Whisper AI transcription as a fallback when YouTube/Podbean transcripts aren't available.

## Why Whisper AI?

YouTube Data API v3 requires OAuth2 authentication (not practical for serverless). YouTube page scraping fails for JavaScript-loaded captions. Whisper AI solves this by transcribing **any audio file**, regardless of captions.

**Benefits**:
- ✅ Works for ANY video/audio (even without captions)
- ✅ FREE tier: 30 hours/month transcription
- ✅ Very accurate (Whisper Large v3 model)
- ✅ No credit card required for free tier
- ✅ No OAuth complexity

## Step 1: Get Hugging Face API Key (Free)

1. Go to: https://huggingface.co/
2. Click **"Sign Up"** (or log in if you have an account)
3. Create a free account (no credit card required)
4. Go to: https://huggingface.co/settings/tokens
5. Click **"New token"**
6. Enter token name: `fxtranscriptor` (or any name)
7. Select **"Read"** access (default)
8. Click **"Generate token"**
9. **Copy the token** (it will look like: `hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
   - ⚠️ **Important**: You can only see this token once! Copy it now.

## Step 2: Add to Vercel

1. Go to your Vercel project: https://vercel.com/dashboard
2. Select your **FX Transcriptor** project
3. Go to **Settings** → **Environment Variables**
4. Click **"Add New"**
5. Enter:
   - **Name**: `HUGGINGFACE_API_KEY`
   - **Value**: `hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (your token from Step 1)
   - **Environments**: Select **Production**, **Preview**, and **Development**
6. Click **"Save"**
7. **Redeploy** your project (or wait for next deployment)

## How It Works

When YouTube and Podbean transcripts fail, the app will:

1. **Download audio file** from Podbean `audio_url` (if available)
2. **Send to Hugging Face Whisper API** for transcription
3. **Store transcript** in database with `transcript_source = "generated"`
4. **Use same transcript** for all users (no re-transcription needed)

### Supported Audio Sources

Currently, Whisper AI works with:
- ✅ **Podbean audio URLs** (from RSS feed - automatically saved)
- ⏳ **YouTube audio URLs** (coming soon - requires audio extraction)

## Free Tier Limits

**Hugging Face Free Tier**:
- **30 hours/month** of transcription
- Rate limits apply (but generous)
- No credit card required
- Automatic throttling when limit reached

**Cost after free tier**: $0.006 per 1000 characters (~$0.06 per hour of audio)

## Troubleshooting

### "Hugging Face model is loading" (503 Error)
- **Cause**: Model is cold-starting (first request in a while)
- **Solution**: Wait 10-20 seconds and try again
- **Note**: Model stays warm for ~5 minutes after use

### "Rate limit exceeded" (429 Error)
- **Cause**: Free tier limit reached (~30 hours/month)
- **Solution**: Wait until next month, or upgrade to paid tier
- **Alternative**: Use fewer transcriptions, focus on most important sermons

### "Transcript too short" Error
- **Cause**: Audio file is too short, silent, or corrupted
- **Solution**: Check audio URL is valid and file is playable
- **Note**: Audio must be at least a few seconds long

### "Hugging Face API key not configured"
- **Cause**: `HUGGINGFACE_API_KEY` environment variable not set in Vercel
- **Solution**: Follow Step 2 above to add the API key

## Testing

Once configured, test by:

1. Go to your sermon catalog
2. Click **"Generate Transcript"** on a sermon that:
   - Has no YouTube/Podbean transcript
   - Has an `audio_url` (from Podbean RSS)
3. Check Vercel logs for `[Whisper]` messages
4. Transcript should appear in database with `transcript_source = "generated"`

## Notes

- **First transcription may be slow** (model loading)
- **Subsequent transcriptions are faster** (model is warm)
- **Transcriptions are cached** in database (no re-transcription needed)
- **Audio files are downloaded temporarily** (not stored permanently)
