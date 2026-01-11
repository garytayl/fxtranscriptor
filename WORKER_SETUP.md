# Audio Chunking Worker Setup

## Overview

For 90-minute sermons (60-80MB), audio must be chunked before transcription. This requires a separate worker service to handle ffmpeg processing.

## Quick Start

### Option 1: Railway (Recommended - Easiest)

1. **Create Railway account**: https://railway.app
2. **Create new project** → "Deploy from GitHub repo"
3. **Select repository** and set root directory to `worker/`
4. **Add environment variables**:
   - `PORT=3000` (auto-set by Railway)
   - `SUPABASE_URL` (from Supabase dashboard)
   - `SUPABASE_SERVICE_KEY` (from Supabase dashboard → Settings → API)
   - `SUPABASE_STORAGE_BUCKET=sermon-chunks`
5. **Create Supabase Storage bucket**:
   - Go to Supabase dashboard → Storage
   - Create bucket: `sermon-chunks`
   - Set public: Yes (or configure CORS)
6. **Deploy** (Railway auto-detects Dockerfile)
7. **Get worker URL** from Railway dashboard (e.g., `https://your-worker.railway.app`)
8. **Add to Vercel**: `AUDIO_WORKER_URL=https://your-worker.railway.app`

### Option 2: Render

1. **Create Render account**: https://render.com
2. **Create new Web Service** → "Build and deploy from a Git repository"
3. **Connect repository** and set:
   - Root Directory: `worker`
   - Build Command: `npm install`
   - Start Command: `npm start`
4. **Add environment variables** (same as Railway)
5. **Create Supabase Storage bucket** (same as Railway)
6. **Deploy**
7. **Get worker URL** and add to Vercel

### Option 3: Fly.io

1. **Install Fly CLI**: https://fly.io/docs/getting-started/installing-flyctl/
2. **Login**: `fly auth login`
3. **In `worker/` directory**: `fly launch`
4. **Set environment variables**: `fly secrets set KEY=value`
5. **Create Supabase Storage bucket** (same as Railway)
6. **Deploy**: `fly deploy`
7. **Get worker URL** and add to Vercel

## Supabase Storage Setup

1. Go to Supabase dashboard → Storage
2. Click "New bucket"
3. Name: `sermon-chunks`
4. Public: Yes (recommended for easy access)
5. Click "Create bucket"

**Optional**: Configure CORS if needed:
- Allowed origins: Your Vercel domain
- Allowed methods: GET, POST
- Allowed headers: *

## Environment Variables

### Worker Service

```
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=sermon-chunks
```

### Vercel

Add to Vercel project settings → Environment Variables:

```
AUDIO_WORKER_URL=https://your-worker.railway.app
```

## Testing

### Test Worker Service

```bash
curl -X POST https://your-worker.railway.app/chunk \
  -H "Content-Type: application/json" \
  -d '{"audioUrl": "https://mcdn.podbean.com/mf/web/audio.m4a"}'
```

### Test Health Endpoint

```bash
curl https://your-worker.railway.app/health
```

## Cost Estimate

- **Railway**: ~$5/month (free tier available for testing)
- **Render**: Free tier available, or $7/month
- **Fly.io**: Free tier available, or ~$5/month
- **Supabase Storage**: Free tier (1GB), $0.021/GB/month after

For sermon chunks (~10MB per 10-min chunk):
- 90-minute sermon = 9 chunks = ~90MB
- 100 sermons = ~9GB = ~$0.19/month

**Total**: ~$5-7/month for reliable 90-minute sermon transcription

## Troubleshooting

### Worker fails to start

- Check Dockerfile builds correctly
- Verify ffmpeg is installed in container
- Check logs for errors

### Chunks not uploading to Supabase

- Verify SUPABASE_URL and SUPABASE_SERVICE_KEY are correct
- Check bucket exists and is accessible
- Verify service key has storage permissions

### Vercel can't reach worker

- Check AUDIO_WORKER_URL is correct
- Verify worker is running (check health endpoint)
- Check CORS settings if needed
