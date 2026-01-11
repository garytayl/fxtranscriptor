# Audio Chunking Worker Service

This worker service handles audio chunking for large files (>20MB) before transcription.

## Overview

The worker:
1. Downloads audio from Podbean URL
2. Transcodes to MP3 mono 16kHz 64kbps (compression)
3. Splits into 10-minute chunks using ffmpeg
4. Uploads chunks to Supabase Storage
5. Returns chunk URLs

## Deployment Options

### Railway

1. Create new project on Railway
2. Connect GitHub repository
3. Set root directory to `worker/`
4. Railway auto-detects Dockerfile
5. Set environment variables (see below)
6. Deploy

### Render

1. Create new Web Service on Render
2. Connect GitHub repository
3. Set root directory to `worker/`
4. Set build command: `npm install`
5. Set start command: `npm start`
6. Set environment variables (see below)
7. Deploy

### Fly.io

1. Install Fly CLI
2. Run `fly launch` in `worker/` directory
3. Set environment variables (see below)
4. Deploy with `fly deploy`

## Environment Variables

```
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
SUPABASE_STORAGE_BUCKET=sermon-chunks (or create your own)
```

## API Endpoint

### POST /chunk

**Request:**
```json
{
  "audioUrl": "https://mcdn.podbean.com/mf/web/audio.m4a"
}
```

**Response:**
```json
{
  "success": true,
  "chunks": [
    {
      "url": "https://storage.supabase.co/chunks/chunk_001.mp3",
      "index": 0,
      "duration": 600,
      "startTime": 0
    },
    {
      "url": "https://storage.supabase.co/chunks/chunk_002.mp3",
      "index": 1,
      "duration": 600,
      "startTime": 600
    }
  ],
  "totalDuration": 5400,
  "chunkCount": 9
}
```

## Local Development

```bash
cd worker
npm install
npm run dev
```

Test:
```bash
curl -X POST http://localhost:3000/chunk \
  -H "Content-Type: application/json" \
  -d '{"audioUrl": "https://mcdn.podbean.com/mf/web/audio.m4a"}'
```
