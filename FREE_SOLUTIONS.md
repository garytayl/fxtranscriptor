# Free & Cheap Solutions for Transcript Generation

This document outlines all the **free and low-cost** solutions used in FX Transcriptor.

## ✅ Currently Implemented (100% Free)

### 1. YouTube Transcript Extraction
- **Package**: `youtube-transcript` (npm)
- **Cost**: FREE (no API keys needed)
- **How it works**: Uses YouTube's public caption API
- **Reliability**: ✅ High - works for videos with captions enabled
- **Limitations**: Only works if video has captions/subtitles

### 2. Podbean RSS & Page Extraction
- **Method**: Direct RSS feed parsing + HTML scraping
- **Cost**: FREE
- **How it works**: Parses Podbean RSS feeds and episode pages
- **Reliability**: ⚠️ Medium - depends on Podbean having transcripts in metadata
- **Limitations**: Many Podbean episodes don't have transcripts in RSS

## 🔄 Future Options (For Whisper Fallback)

When YouTube/Podbean extraction fails, we need a fallback. Here are free/cheap options:

### Option 1: Hugging Face Inference API (FREE Tier)
- **Service**: Hugging Face Whisper Models
- **Cost**: FREE (limited requests), then $0.006/1000 characters
- **Free Tier**: ~30 hours/month of transcription
- **How to use**:
  ```typescript
  // Example (not yet implemented)
  const response = await fetch(
    'https://api-inference.huggingface.co/models/openai/whisper-large-v3',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: audioData, // Base64 encoded audio
      }),
    }
  );
  ```
- **Pros**: 
  - Free tier available
  - Very accurate (Whisper Large v3)
  - No credit card required for free tier
- **Cons**: 
  - Rate limits on free tier
  - Requires audio file download + processing
  - Slower than direct captions

### Option 2: AssemblyAI (FREE Tier)
- **Service**: AssemblyAI Transcription API
- **Cost**: FREE (5 hours/month), then $0.00025/second
- **Free Tier**: 5 hours/month of transcription
- **Pros**: 
  - Easy API
  - Good free tier
  - Fast
- **Cons**: 
  - Limited free hours
  - Requires audio download

### Option 3: Deepgram (FREE Tier)
- **Service**: Deepgram Speech-to-Text
- **Cost**: FREE ($200 credit for new accounts), then $0.0043/min
- **Free Tier**: $200 credit (good for testing)
- **Pros**: 
  - Generous free credits
  - Very fast
- **Cons**: 
  - Requires credit card for free tier
  - Credits expire

### Option 4: Local Whisper (Not Recommended for Vercel)
- **Service**: Run Whisper locally
- **Cost**: FREE (but requires infrastructure)
- **Why not for Vercel**: 
  - Vercel serverless functions have execution time limits
  - Whisper requires significant processing power
  - Would need a separate server/container
- **When useful**: Self-hosted setup with dedicated servers

## 📊 Recommendation

**Current Priority**:
1. ✅ YouTube (already implemented, free)
2. ✅ Podbean (already implemented, free)
3. 🔄 **Add Hugging Face Whisper** (best free option)

**Why Hugging Face**:
- ✅ No credit card required for free tier
- ✅ 30 hours/month is generous (1 hour/day average)
- ✅ Very accurate (Whisper Large v3 model)
- ✅ Simple API
- ✅ Works on Vercel serverless

## 💰 Cost Estimate (if we exceed free tiers)

For a church with 818 sermons, each averaging 30-60 minutes:

- **If 10% need Whisper transcription** (82 sermons):
  - Hugging Face: ~$0.006 per 1000 chars ≈ **$5-10/month** (very affordable)
  - AssemblyAI: ~$0.00025/sec × 2700 sec = **$0.68 per sermon** (not free)
  - Deepgram: ~$0.0043/min × 45 min = **$0.19 per sermon** (not free)

**Best value**: Hugging Face Inference API (free tier + lowest paid rates)

## 🚀 Next Steps

To add Whisper fallback:
1. Get free Hugging Face API key: https://huggingface.co/settings/tokens
2. Add `HUGGINGFACE_API_KEY` to Vercel env vars
3. Implement audio download from Podbean `audio_url`
4. Convert audio to base64 or use direct file upload
5. Call Hugging Face Whisper API
6. Store transcript in database

Would be a great future enhancement! 🎯
