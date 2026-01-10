# Vercel Environment Variables Setup

## Required (but currently using hardcoded fallbacks)

These are required for production, but the app has hardcoded fallbacks so it will work without them. **However, it's best practice to set them:**

1. **`NEXT_PUBLIC_SUPABASE_URL`**
   - Value: `https://mfzrunlgkpbtiwuzmivq.supabase.co`
   - Already hardcoded as fallback, but set this for production

2. **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1menJ1bmxna3BidGl3dXptaXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNzExOTcsImV4cCI6MjA4MzY0NzE5N30.0t5wve3InEVRGev5i_FwTohcxvZ_rmo4QwWTULv5RSc`
   - Already hardcoded as fallback, but set this for production

## Optional (defaults are fine)

These have defaults already set, but you can override them if needed:

3. **`PODBEAN_RSS_URL`** (optional)
   - Default: `https://fxtalk.podbean.com/feed.xml`
   - Only set if your RSS feed URL is different

4. **`YOUTUBE_CHANNEL_ID`** (optional)
   - Default: `@fxchurch`
   - Only set if your YouTube channel is different

## Your Local Environment File

Your `.env.local` file is already set up at:
```
/Users/garytaylor/Documents/fxtranscriptor/.env.local
```

It contains:
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ `PODBEAN_RSS_URL`
- ✅ `YOUTUBE_CHANNEL_ID`

## How to Set on Vercel

### Method 1: Via Vercel CLI (Fastest - Recommended if you have CLI installed)

```bash
# Install Vercel CLI if not installed
npm i -g vercel

# Login to Vercel
vercel login

# Link your project (if not already linked)
vercel link

# Pull env vars from your .env.local (syncs to Vercel)
# This will prompt you to add each variable
vercel env add NEXT_PUBLIC_SUPABASE_URL production preview development
# Paste: https://mfzrunlgkpbtiwuzmivq.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production preview development
# Paste: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1menJ1bmxna3BidGl3dXptaXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNzExOTcsImV4cCI6MjA4MzY0NzE5N30.0t5wve3InEVRGev5i_FwTohcxvZ_rmo4QwWTULv5RSc

vercel env add PODBEAN_RSS_URL production preview development
# Paste: https://fxtalk.podbean.com/feed.xml

vercel env add YOUTUBE_CHANNEL_ID production preview development
# Paste: @fxchurch

# Redeploy with new env vars
vercel --prod
```

**OR** you can manually copy the values from your `.env.local` file.

### Method 2: Via Vercel Dashboard (Manual - Easiest)

1. Go to your project on Vercel: https://vercel.com/dashboard
2. Click on your **FX Transcriptor** project
3. Go to **Settings** → **Environment Variables**
4. Add each variable:
   - Click **"Add New"**
   - Enter the variable name (e.g., `NEXT_PUBLIC_SUPABASE_URL`)
   - Enter the value
   - Select environment(s): **Production**, **Preview**, and **Development**
   - Click **"Save"**
5. Repeat for all variables
6. **Redeploy** your project (or wait for next deployment)

### Method 2: Via Vercel CLI

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Link your project (if not already linked)
vercel link

# Add environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
# Paste: https://mfzrunlgkpbtiwuzmivq.supabase.co
# Select: Production, Preview, Development

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# Paste: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1menJ1bmxna3BidGl3dXptaXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNzExOTcsImV4cCI6MjA4MzY0NzE5N30.0t5wve3InEVRGev5i_FwTohcxvZ_rmo4QwWTULv5RSc
# Select: Production, Preview, Development

# Redeploy with new env vars
vercel --prod
```

## Important Notes

- ⚠️ **Since credentials are hardcoded as fallbacks, the app will work WITHOUT env vars** - but it's not secure for production
- 🔒 **For production, always use environment variables** instead of hardcoded credentials
- 🔄 **After adding env vars, redeploy** your project for them to take effect
- ✅ **The `NEXT_PUBLIC_` prefix** is required for client-side accessible variables in Next.js

## Optional (For Better Transcript Extraction)

5. **`YOUTUBE_API_KEY`** (optional, but recommended)
   - Setup: See `YOUTUBE_API_SETUP.md`
   - Value: Your YouTube Data API v3 key (starts with `AIzaSy...`)
   - Note: This helps with caption detection, but download requires OAuth2 (limitation)

6. **`HUGGINGFACE_API_KEY`** (optional, but recommended for fallback transcription)
   - Setup: See `HUGGINGFACE_SETUP.md`
   - Value: Your Hugging Face API token (starts with `hf_...`)
   - Note: Enables Whisper AI transcription for videos without accessible captions
   - Free tier: 30 hours/month transcription

## Quick Setup Checklist

- [ ] Set `NEXT_PUBLIC_SUPABASE_URL` on Vercel
- [ ] Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` on Vercel
- [ ] (Optional) Set `PODBEAN_RSS_URL` if different from default
- [ ] (Optional) Set `YOUTUBE_CHANNEL_ID` if different from default
- [ ] (Recommended) Set `YOUTUBE_API_KEY` for better caption detection
- [ ] (Recommended) Set `HUGGINGFACE_API_KEY` for Whisper AI fallback transcription
- [ ] Redeploy project
- [ ] Test the site works correctly

## Current Status

✅ **Database schema is set up** (tables exist)  
✅ **App is working locally** (sermons are populating)  
⚠️ **Need to set env vars on Vercel** (for production best practices)
