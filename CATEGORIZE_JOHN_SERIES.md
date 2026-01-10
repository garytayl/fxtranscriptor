# Categorizing John: πιστεύω - Fall 2025 Series

This guide explains how to categorize all 21 sermons from the "John: πιστεύω - Fall 2025" playlist.

## Playlist Information

- **Playlist URL**: `https://youtube.com/playlist?list=PLQwpPWOYg4MOLr9lUNMBgjCCV0ifkKMDu`
- **Playlist Title**: "John: πιστεύω - Fall 2025"
- **Total Videos**: 21 videos
- **Series Description**: We live life in troubled times with troubled hearts. Who or what do we believe? The Greek word, πιστεύω (pronounced "pisteuo") is closely translated as "believe". It is not just an intellectual exercise. It is an entrusting of one's self to a person or a cause. The gospel of John uses pisteuo 98 times!

## How It Works

### Step 1: Sync the Catalog

1. Click the "Sync Catalog" button in the app (or call `/api/catalog/sync`)
2. This fetches all sermons from:
   - Podbean RSS feed
   - YouTube channel (@fxchurch)
3. Matches Podbean episodes to YouTube videos (deduplication)
4. Stores all sermons in the database with `youtube_video_id` for each YouTube video

### Step 2: Playlist Matching (Automatic)

1. When the page loads, it automatically fetches playlist data
2. The playlist fetcher gets all 21 video IDs from the playlist
3. Matches each video ID to sermons in the database by `youtube_video_id`
4. Groups all matching sermons under the series name: **"John: πιστεύω - Fall 2025"**

### Step 3: Series Display

All matched sermons will appear under the "John: πιστεύω - Fall 2025" series card:
- Series name: "John: πιστεύω - Fall 2025" (with Greek characters preserved)
- Sermon count: Shows how many sermons matched (up to 21)
- Date range: Shows the earliest and latest sermon dates
- Transcript count: Shows how many have transcripts generated

## Expected Results

After syncing and matching, you should see:

```
Series: John: πιστεύω - Fall 2025
- 21 sermons (or however many matched)
- Date range: August 24, 2025 - December 28, 2025
- Sermons include:
  * Sunday Service - 12/28/2025
  * Sunday Service - 12/21/2025
  * Sunday Service - 12/7/25
  * Sunday Service - 11/30/2025
  * ... (all 21 videos from playlist)
```

## Troubleshooting

### Not All Sermons Are Categorized

**Problem**: Only some sermons show up in the series, not all 21.

**Possible Causes**:
1. **Not synced yet**: Some YouTube videos haven't been synced to the database
   - **Solution**: Run "Sync Catalog" to fetch all YouTube videos

2. **Video IDs don't match**: The `youtube_video_id` in the database doesn't match the video IDs in the playlist
   - **Solution**: Check that sermons have `youtube_video_id` populated. If not, re-sync.

3. **API quota/rate limiting**: YouTube API might be rate-limited
   - **Solution**: Check browser console for errors. The system falls back to scraping if API fails.

### Series Name Looks Wrong

**Problem**: Series name is "John: πιστεύω - Fall 2025 - YouTube" or has extra text.

**Solution**: The title cleaning function automatically removes:
- "- YouTube" suffix
- Parenthetical notes at end
- "by Channel Name" suffix

The series name should be exactly: **"John: πιστεύω - Fall 2025"**

### Playlist Not Found

**Problem**: Error message says playlist not found or empty.

**Possible Causes**:
1. **Playlist is private**: The playlist might not be publicly accessible
   - **Solution**: Make sure the playlist is public on YouTube

2. **Invalid playlist ID**: The playlist ID might be incorrect
   - **Solution**: Verify the playlist URL is correct

3. **YouTube API issues**: API key might be invalid or quota exceeded
   - **Solution**: Check `YOUTUBE_API_KEY` environment variable. The system will try scraping as fallback.

## Manual Verification

To verify which sermons matched:

1. Open browser DevTools Console
2. Look for log messages like:
   ```
   [Playlist Series] Loaded 21 sermon-series mappings from 1 playlists
   ```
3. Check the API response from `/api/playlists/fetch`:
   ```json
   {
     "success": true,
     "playlists": [{
       "playlistId": "PLQwpPWOYg4MOLr9lUNMBgjCCV0ifkKMDu",
       "playlistTitle": "John: πιστεύω - Fall 2025",
       "seriesName": "John: πιστεύω - Fall 2025",
       "videoCount": 21,
       "matchedSermonCount": 21,
       "sermonIds": ["uuid1", "uuid2", ...]
     }]
   }
   ```

## Next Steps

Once all sermons are categorized:

1. **Generate Transcripts**: Click "Generate Transcript" for each sermon
2. **Review Series**: Click on the series card to see all sermons in detail
3. **Add More Playlists**: Add other sermon series playlists to `app/page.tsx`
4. **Auto-Discover**: (Future) Automatically discover all playlists from the channel

## Current Status

✅ Playlist is configured: `PLQwpPWOYg4MOLr9lUNMBgjCCV0ifkKMDu`
✅ Title cleaning preserves Greek characters (πιστεύω)
✅ Automatic matching on page load
✅ Falls back to title extraction for non-playlist sermons

Ready to categorize! Just sync the catalog and all matching sermons will be automatically grouped.
