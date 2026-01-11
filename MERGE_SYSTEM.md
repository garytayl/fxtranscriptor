# Intelligent Merge System for Podbean & YouTube

This system intelligently merges sermons from Podbean and YouTube into consolidated records, handling cases where the same sermon exists on both platforms or only on one.

## The Problem

- **One sermon per week** gets uploaded to both Podbean and YouTube
- Sometimes one doesn't make it to the other platform
- Need to merge and consolidate into single sermon records
- Need to preserve all data from both sources

## The Solution

### 1. Merge Script (`npm run merge-sources`)

This script:
- Fetches all Podbean episodes from RSS feed
- Fetches all YouTube videos from channel
- Uses intelligent matching algorithm to find same sermons across platforms
- Merges matched sermons into single records with data from both sources
- Creates records for unmatched episodes (Podbean-only or YouTube-only)

**Matching Algorithm:**
- **Date-based matching** (primary): Matches sermons within ±7 days
- **Title similarity** (secondary): Jaccard similarity + substring matching
- **Episode number matching**: Extracts and matches episode numbers
- **Bidirectional**: Matches Podbean→YouTube and YouTube→Podbean

**Merge Behavior:**
- If sermon exists with only Podbean → adds YouTube data
- If sermon exists with only YouTube → adds Podbean data + audio URL
- If sermon exists with both → updates with best data from both
- Creates new records for unmatched episodes

### 2. Sync Catalog (`/api/catalog/sync`)

The existing sync endpoint also does intelligent merging:
- Uses the same matching algorithm
- Updates existing sermons with missing data
- Handles reverse matching (YouTube-only → Podbean)

## Usage

### Run Merge Script

```bash
npm run merge-sources
```

This will:
1. Fetch Podbean and YouTube catalogs
2. Match sermons intelligently
3. Merge/update/create sermon records
4. Show summary of what was merged

### Run Sync Catalog (Alternative)

In your browser:
1. Click "Sync Catalog" button
2. This uses the same matching logic via API

## What Gets Merged

When a sermon exists on both platforms, the system merges:

- **Title**: Uses best/most complete title
- **Date**: Uses most accurate date
- **Description**: Merges descriptions (prefers longer one)
- **Podbean URL**: Adds if missing
- **YouTube URL**: Adds if missing
- **YouTube Video ID**: Adds if missing
- **Audio URL**: Always prefers Podbean audio URL (for transcription)

## Example Scenarios

### Scenario 1: Same Sermon on Both Platforms
- **Before**: Two separate records (one Podbean, one YouTube)
- **After**: One merged record with both URLs and audio URL

### Scenario 2: YouTube-Only Sermon
- **Before**: Sermon exists with only YouTube URL
- **After**: Matched with Podbean episode, audio URL added

### Scenario 3: Podbean-Only Sermon
- **Before**: Sermon exists with only Podbean URL
- **After**: Matched with YouTube video, YouTube URL added

### Scenario 4: Unmatched Episodes
- **Before**: Episode exists on one platform but not matched
- **After**: Created as single-source sermon (Podbean-only or YouTube-only)

## Best Practices

1. **Run merge regularly**: After uploading new sermons to either platform
2. **Run sync catalog**: Alternative method that does the same thing via UI
3. **Check for unmatched**: Review Podbean-only and YouTube-only sermons
4. **Manual fixes**: For edge cases, manually set audio URLs via UI

## Troubleshooting

### No matches found
- Check if dates are close enough (±7 days)
- Check if titles are similar enough
- May need to run sync catalog which has more sophisticated matching

### Audio URLs not set
- Podbean episodes must have audio URLs in RSS feed
- If missing, manually set via UI using Podbean episode URL

### Duplicate sermons
- Merge script should prevent duplicates
- If duplicates exist, they'll be merged on next run
