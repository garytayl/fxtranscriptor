# YouTube Data API v3 Setup Guide

This guide will help you set up YouTube Data API v3 to extract transcripts reliably, even for videos with JavaScript-loaded captions.

## Step 1: Create Google Cloud Project (Free)

1. Go to: https://console.cloud.google.com/
2. Click "Select a project" → "New Project"
3. Enter project name: `fxtranscriptor` (or any name)
4. Click "Create"
5. Wait ~30 seconds for project to be created

## Step 2: Enable YouTube Data API v3

1. In your project, go to: **APIs & Services** → **Library**
2. Search for: `YouTube Data API v3`
3. Click on it
4. Click **"Enable"**
5. Wait for it to enable (takes a few seconds)

## Step 3: Create API Key

1. Go to: **APIs & Services** → **Credentials**
2. Click **"Create Credentials"** → **"API Key"**
3. Copy the API key (it will look like: `AIzaSyD...`)
4. (Optional) Click "Restrict Key" to limit it to YouTube Data API v3 only
5. Click "Save"

## Step 4: Add to Vercel

1. Go to your Vercel project: https://vercel.com/dashboard
2. Select your **FX Transcriptor** project
3. Go to **Settings** → **Environment Variables**
4. Click **"Add New"**
5. Enter:
   - **Name**: `YOUTUBE_API_KEY`
   - **Value**: `AIzaSyD...` (your API key from Step 3)
   - **Environments**: Select **Production**, **Preview**, and **Development**
6. Click **"Save"**
7. **Redeploy** your project (or wait for next deployment)

## ⚠️ Important Limitation

**YouTube Data API v3 `captions.download` endpoint requires OAuth2 authentication**, not just an API key. This is a limitation for serverless functions.

**However**, we still implement it because:
1. Some videos may work with just an API key (depends on video settings)
2. It provides better error messages
3. `captions.list` endpoint works with API key and can verify captions exist

**If captions.download fails with OAuth errors**, you have two options:
1. **Use Whisper AI fallback** (Option 2 - recommended, works for any video)
2. **Accept the limitation** (some videos won't work with automated extraction)

## Step 5: Test It

After redeploying:
1. Try generating a transcript on a sermon with a YouTube URL
2. Check Vercel logs - you should see: `[fetchTranscript] Trying YouTube Data API v3...`
3. **If OAuth is required**, you'll see: `Caption download requires OAuth2 authentication`
4. If successful, you'll see: `✅ YouTube Data API v3 succeeded`

**Note**: Due to OAuth requirement, many videos may still fail. Whisper AI fallback (Option 2) is recommended for reliability.

## Free Tier Limits

**YouTube Data API v3 Free Quota**:
- **10,000 units per day** (refreshes at midnight Pacific Time)
- Listing caption tracks: **1 unit** per request
- Downloading captions: **50 units** per request
- **200 caption downloads per day** (10,000 ÷ 50)
- **Very generous** for most use cases

**Cost if you exceed**:
- $0.02 per 1,000 units after free tier
- Still very affordable

## Troubleshooting

### "API key is invalid"
- Make sure you copied the full API key
- Check for extra spaces when pasting into Vercel
- Make sure API key is added to all environments (Production, Preview, Development)

### "API quota exceeded"
- Wait until midnight Pacific Time (quota resets daily)
- Or upgrade to paid tier if needed
- Check Google Cloud Console → APIs & Services → Dashboard for usage

### "API not enabled"
- Go back to Step 2 and make sure YouTube Data API v3 is enabled
- Wait a few minutes after enabling (can take time to propagate)

### "No caption tracks found"
- The video might truly not have captions
- Check manually on YouTube: Click "Show transcript" on the video
- Some videos have captions disabled by the uploader

## Benefits

✅ **Works for JavaScript-loaded captions** (the main issue we're solving)  
✅ **Official API** (reliable, won't break when YouTube changes HTML)  
✅ **Free tier** (10k units/day, plenty for your use case)  
✅ **Works on Vercel** (serverless-friendly)  
✅ **No scraping** (legal, reliable, future-proof)

## Quick Checklist

- [ ] Created Google Cloud project
- [ ] Enabled YouTube Data API v3
- [ ] Created API key
- [ ] Added `YOUTUBE_API_KEY` to Vercel environment variables
- [ ] Selected all environments (Production, Preview, Development)
- [ ] Redeployed project
- [ ] Tested transcript generation

That's it! 🎉
