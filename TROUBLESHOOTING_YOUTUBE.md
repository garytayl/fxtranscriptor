# Troubleshooting YouTube Audio Extraction

## Issue: "Still requires the audio URL" for YouTube-only sermons

### Step 1: Verify `AUDIO_WORKER_URL` is set in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Check if `AUDIO_WORKER_URL` exists
4. If not, add it:
   - **Key**: `AUDIO_WORKER_URL`
   - **Value**: Your Railway worker URL (e.g., `https://your-worker.railway.app`)
   - **Environment**: Production (and Preview if needed)
5. **Redeploy** your Vercel app after adding the variable

### Step 2: Verify sermons have `youtube_url` populated

Check if your John series sermons actually have `youtube_url` set in the database:

1. Go to Supabase dashboard → Table Editor → `sermons`
2. Find a John series sermon
3. Check if `youtube_url` column has a value (should be like `https://www.youtube.com/watch?v=VIDEO_ID`)

If `youtube_url` is NULL:
- Re-run the populate script: `npx tsx scripts/populate-john-series.ts`
- Or manually update sermons to include `youtube_url`

### Step 3: Check Railway worker is running

1. Go to Railway dashboard
2. Check your worker service is **Running** (green status)
3. Test the health endpoint:
   ```bash
   curl https://your-worker.railway.app/health
   ```
   Should return: `{"status":"ok","service":"audio-chunking-worker"}`

### Step 4: Check browser console

When you click "Generate Transcript" on a YouTube-only sermon:

1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Look for log messages:
   - `[Generate] No audio_url found, using YouTube URL for transcription: ...`
   - `[Generate] Delegating transcription to Railway worker...`
   - Or error messages about missing `AUDIO_WORKER_URL`

### Step 5: Verify the flow

The expected flow for YouTube-only sermons:

1. **UI**: Should show "Generate from YouTube" button (not "Set Audio URL" prompt)
2. **Click Generate**: Should send request to `/api/catalog/generate`
3. **API**: Should detect `youtube_url`, check for `AUDIO_WORKER_URL`, and send to worker
4. **Worker**: Should extract audio from YouTube and transcribe

## Common Issues

### Issue: "YouTube audio extraction requires the worker service"

**Cause**: `AUDIO_WORKER_URL` not set in Vercel

**Fix**: 
1. Get your Railway worker URL
2. Add `AUDIO_WORKER_URL` to Vercel environment variables
3. Redeploy Vercel app

### Issue: UI still shows "Set Audio URL" prompt

**Cause**: Sermon doesn't have `youtube_url` populated

**Fix**: 
1. Check database - verify `youtube_url` is set
2. Re-run populate script if needed
3. Refresh the page

### Issue: Worker returns error

**Cause**: Worker can't extract YouTube audio

**Possible reasons**:
- Video is private/unavailable
- YouTube rate limiting
- `ytdl-core` not installed properly

**Fix**: Check Railway worker logs for specific error

## Quick Test

To verify everything is working:

1. Find a sermon with only `youtube_url` (no `audio_url`)
2. Click "Generate Transcript"
3. Should see: "Transcription queued. Check back in a few minutes."
4. Check sermon status - should change to "generating"
5. Wait a few minutes, then refresh
6. Transcript should appear

If any step fails, check the error message and follow the troubleshooting steps above.
