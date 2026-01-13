# Metadata Extraction Feature

This feature automatically extracts series and speaker information from sermon transcripts and uses it to organize sermons.

## What It Does

1. **Extracts Metadata**: When transcripts are generated, the system automatically parses `[SERIES]`, `[SPEAKER]`, and `[SUMMARY]` tags from the transcript text
2. **Saves to Database**: The extracted series and speaker information is saved to the database
3. **Displays in UI**: Series and speaker information is displayed prominently in the sermon detail view
4. **Auto-Organizes**: Sermons are automatically grouped into series based on the extracted metadata

## Setup Required

### 1. Run Database Migration

Run the migration file to add the new columns:

```sql
-- Run this in your Supabase SQL Editor
-- File: supabase/migration_add_series_speaker.sql
```

Or manually run:

```sql
ALTER TABLE sermons 
ADD COLUMN IF NOT EXISTS series TEXT,
ADD COLUMN IF NOT EXISTS speaker TEXT;

CREATE INDEX IF NOT EXISTS idx_sermons_series ON sermons(series);
CREATE INDEX IF NOT EXISTS idx_sermons_speaker ON sermons(speaker);
```

## How It Works

### Metadata Format

The system looks for metadata in this format in transcripts:

```
[SERIES] Isaiah: The Holy One of Israel     [SPEAKER] Mat Shockney     [SUMMARY] We all come to a place...
```

### Priority Order for Series Grouping

1. **Playlist-based series** (highest priority) - from YouTube playlists
2. **Extracted series metadata** (second priority) - from transcript `[SERIES]` tags
3. **Ungrouped** - if neither exists

### Where Metadata Appears

- **Sermon Detail Page**: Series and speaker badges appear below the title
- **Main Catalog Dialog**: Series and speaker information shown in the dialog header
- **Series Organization**: Sermons with extracted series metadata are automatically grouped

## Files Changed

- `lib/extractMetadata.ts` - New utility for parsing metadata
- `components/sermon-metadata.tsx` - New UI component for displaying metadata
- `lib/supabase.ts` - Updated Sermon interface to include series and speaker
- `app/api/catalog/generate/route.ts` - Extracts metadata when saving transcripts
- `worker/server.js` - Extracts metadata in worker service
- `lib/extractSeries.ts` - Updated to use extracted series metadata
- `app/sermons/[id]/page.tsx` - Displays metadata in sermon detail view
- `app/page.tsx` - Displays metadata in catalog dialog

## Future Enhancements

- Batch extraction: Extract metadata from existing transcripts
- Manual editing: Allow users to manually set/edit series and speaker
- Speaker filtering: Filter sermons by speaker
- Series management: Better UI for managing series
