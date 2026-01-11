# Audio Chunking Implementation Plan

## Overview

For 90-minute sermons (60-80MB), chunking is the most reliable solution. This document outlines the implementation plan.

## Architecture

```
┌─────────────┐
│  Vercel App │
└──────┬──────┘
       │
       │ POST /chunk { audioUrl }
       ↓
┌──────────────────────┐
│  Audio Worker Service│
│  (Railway/Render/Fly)│
└──────┬───────────────┘
       │
       │ 1. Download audio
       │ 2. ffmpeg: transcode + chunk
       │ 3. Upload chunks to storage
       ↓
┌──────────────────────┐
│  Supabase Storage    │
│  (or worker storage) │
└──────┬───────────────┘
       │
       │ Return chunk URLs
       ↓
┌─────────────┐
│  Vercel App │
└──────┬──────┘
       │
       │ For each chunk:
       │ → Whisper API
       │ → Store transcript
       │
       │ Merge all transcripts
       │ Store final result
```

## Worker Service Specification

### Endpoint: `POST /chunk`

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
      "url": "https://storage.supabase.co/chunks/chunk_001.m4a",
      "index": 0,
      "duration": 600,
      "startTime": 0
    },
    {
      "url": "https://storage.supabase.co/chunks/chunk_002.m4a",
      "index": 1,
      "duration": 600,
      "startTime": 600
    }
  ],
  "totalDuration": 5400,
  "chunkCount": 9
}
```

### Worker Implementation (Node.js + ffmpeg)

**Dependencies:**
- `express` - HTTP server
- `fluent-ffmpeg` - ffmpeg wrapper
- `@supabase/storage-js` - Supabase Storage (optional)
- `axios` - HTTP client for downloading

**Dockerfile:**
```dockerfile
FROM node:18-alpine

# Install ffmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
```

**Key ffmpeg commands:**
```bash
# Split into 10-minute chunks (600 seconds)
ffmpeg -i input.m4a -f segment -segment_time 600 -c copy output_%03d.m4a

# Or compress + chunk (smaller files)
ffmpeg -i input.m4a -f segment -segment_time 600 -ar 16000 -ac 1 -b:a 64k output_%03d.mp3
```

## Vercel Integration

### New API Route: `/api/audio/chunk`

```typescript
// app/api/audio/chunk/route.ts
export async function POST(request: NextRequest) {
  const { audioUrl } = await request.json();
  
  // Call worker service
  const response = await fetch(`${WORKER_URL}/chunk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioUrl }),
  });
  
  const data = await response.json();
  return NextResponse.json(data);
}
```

### Updated Transcript Generation

```typescript
// In app/api/catalog/generate/route.ts

// If file > 25MB, use chunking
if (sizeMB > 25) {
  // 1. Chunk audio via worker
  const chunkResult = await fetch('/api/audio/chunk', {
    method: 'POST',
    body: JSON.stringify({ audioUrl: sermon.audio_url }),
  });
  
  const chunks = await chunkResult.json();
  
  // 2. Transcribe each chunk
  const transcripts: string[] = [];
  for (const chunk of chunks.chunks) {
    const transcript = await transcribeWithWhisper(chunk.url, apiKey);
    transcripts.push(transcript);
  }
  
  // 3. Merge transcripts
  const finalTranscript = transcripts.join('\n\n');
  
  // 4. Store result
  await supabase.from('sermons').update({
    transcript: finalTranscript,
    status: 'completed',
  }).eq('id', sermonId);
}
```

## Database Schema Updates

Add fields to track chunking progress:

```sql
ALTER TABLE sermons ADD COLUMN chunking_status TEXT;
ALTER TABLE sermons ADD COLUMN chunk_count INTEGER;
ALTER TABLE sermons ADD COLUMN chunks_processed INTEGER;
```

## Deployment Steps

1. **Choose worker service** (Railway/Render/Fly)
2. **Deploy worker** with Dockerfile
3. **Set environment variables:**
   - `WORKER_URL` (for Vercel)
   - `SUPABASE_URL` (if using Supabase Storage)
   - `SUPABASE_SERVICE_KEY` (if using Supabase Storage)
4. **Update Vercel code** to use chunking for large files
5. **Test with a 90-minute sermon**

## Alternative: Simpler Worker (Return Chunks as Base64)

If storage is complex, worker can return chunks as base64:

```json
{
  "chunks": [
    {
      "data": "base64...",
      "index": 0,
      "mimeType": "audio/mp4"
    }
  ]
}
```

Vercel then uploads to temporary storage or processes directly.

## Cost Estimate

**Worker Service:**
- Railway: ~$5/month
- Render: Free tier (or $7/month)
- Fly.io: Free tier (or ~$5/month)

**Storage (if using Supabase):**
- Free tier: 1GB (plenty for chunks)
- Chunks are temporary (delete after transcription)

**Total: ~$0-5/month** for reliable 90-minute sermon transcription
