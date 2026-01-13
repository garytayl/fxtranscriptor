# Transcription Queue System

## Overview

The transcription queue system ensures that only **one sermon is transcribed at a time globally**, across all users. This prevents resource conflicts and ensures fair processing of transcription requests.

## Features

- ✅ **Global Queue**: Only one sermon processes at a time, visible to all users
- ✅ **Queue UI**: Real-time queue display showing current processing and queued items
- ✅ **Cancel Functionality**: Users can cancel their transcription requests
- ✅ **Position Tracking**: Shows position in queue for each sermon
- ✅ **Status Updates**: Real-time progress updates for currently processing sermons
- ✅ **Automatic Processing**: Queue processor runs automatically via cron jobs and UI triggers

## Database Setup

Run the migration to create the queue table:

```sql
-- Run this in Supabase SQL Editor
-- File: supabase/migration_add_transcription_queue.sql
```

This creates:
- `transcription_queue` table
- Indexes for efficient queries
- RLS policies for public read/write access
- Helper function `get_next_queue_position()`

## API Endpoints

### `/api/queue/add` (POST)
Adds a sermon to the transcription queue.

**Request:**
```json
{
  "sermonId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Added to transcription queue",
  "queueItem": { ... }
}
```

### `/api/queue/list` (GET)
Returns the current state of the queue.

**Response:**
```json
{
  "success": true,
  "queue": {
    "processing": { ... } | null,
    "queued": [ ... ],
    "all": [ ... ]
  }
}
```

### `/api/queue/cancel` (POST)
Cancels a sermon in the queue.

**Request:**
```json
{
  "sermonId": "uuid"
}
```

### `/api/queue/process` (POST)
Gets the next item from the queue and marks it as processing. Called internally by the processor.

### `/api/queue/processor` (POST)
Main processor endpoint. Checks for next item and triggers worker transcription.

### `/api/queue/complete` (POST)
Marks a queue item as complete. Called by the worker after transcription finishes.

**Request:**
```json
{
  "sermonId": "uuid",
  "success": true,
  "errorMessage": "..." // if success is false
}
```

### `/api/queue/cron` (GET)
Cron endpoint for periodic queue processing. Can be called by Vercel Cron Jobs.

## Queue Processing

The queue is processed automatically in multiple ways:

1. **On Add**: When a sermon is added to the queue, the processor is triggered automatically
2. **UI Polling**: The queue component triggers the processor every 10 seconds
3. **Cron Job**: Vercel cron job calls `/api/queue/cron` every 10 seconds (configured in `vercel.json`)

## Queue States

- **queued**: Waiting to be processed
- **processing**: Currently being transcribed
- **completed**: Transcription finished successfully
- **failed**: Transcription failed
- **cancelled**: Cancelled by user

## UI Component

The `TranscriptionQueue` component displays:
- Currently processing sermon with progress
- Queued sermons with position numbers
- Cancel buttons for each item
- Real-time updates (polls every 5 seconds)

## Integration

The queue system is integrated into the main page (`app/page.tsx`). When users click "Generate Transcript", the sermon is automatically added to the queue instead of being processed immediately.

## Worker Integration

The worker service (`worker/server.js`) has been updated to:
- Call `/api/queue/complete` when transcription succeeds
- Call `/api/queue/complete` when transcription fails
- Check for cancellation status during processing

## Environment Variables

No new environment variables are required. The system uses existing:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `AUDIO_WORKER_URL`
- `NEXT_PUBLIC_APP_URL` (optional, auto-detected on Vercel)

## Cron Job Setup

The cron job is configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/queue/cron",
      "schedule": "*/1 * * * *"
    }
  ]
}
```

This runs every minute (minimum Vercel cron interval). The UI component also triggers the processor every 10 seconds for faster processing.

## Testing

1. Add a sermon to the queue via the UI
2. Check the queue display - should show the sermon as "queued" or "processing"
3. Add another sermon - should show position 2
4. Cancel a queued sermon - should be removed from queue
5. Cancel a processing sermon - worker will stop when it checks status

## Troubleshooting

**Queue not processing:**
- Check that cron jobs are enabled in Vercel
- Verify `AUDIO_WORKER_URL` is set
- Check worker logs for errors
- Ensure database migration was run

**Queue items stuck:**
- Manually update status in database if needed
- Check for errors in queue processor logs
- Verify worker is accessible

**UI not updating:**
- Check browser console for errors
- Verify `/api/queue/list` endpoint is accessible
- Check network tab for failed requests
