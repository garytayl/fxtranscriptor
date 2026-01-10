# YouTube Playlist Series Organization

FX Archive automatically organizes sermons into series based on YouTube playlists. This provides much more accurate series organization than title-based extraction.

## How It Works

1. **Playlist Structure**: YouTube playlists naturally organize sermons into series
2. **Auto-Matching**: Videos in playlists are matched to sermons by `youtube_video_id`
3. **Series Names**: Playlist titles become series names (e.g., "Sermon Series Name" from playlist)
4. **Priority**: Playlist-based series names take priority over title extraction
5. **Fallback**: If a sermon isn't in any playlist, title-based extraction is used

## Setup

### Default Playlist

The app automatically uses this default playlist:
- **Latest Series**: `https://youtube.com/playlist?list=PLQwpPWOYg4MOLr9lUNMBgjCCV0ifkKMDu`

This is hardcoded in `app/page.tsx` in the `loadPlaylistSeries` function.

### Adding More Playlists

To add more playlists, edit `app/page.tsx`:

```typescript
const defaultPlaylists = [
  "https://youtube.com/playlist?list=PLQwpPWOYg4MOLr9lUNMBgjCCV0ifkKMDu", // Latest series
  "https://youtube.com/playlist?list=ANOTHER_PLAYLIST_ID", // Another series
  // Add more playlists here...
];
```

Or, you can add a server-side API endpoint to fetch all playlists from the channel automatically (future enhancement).

## API Endpoint

### POST `/api/playlists/fetch`

Fetches playlist data and matches videos to sermons.

**Request Body:**
```json
{
  "playlistUrls": [
    "https://youtube.com/playlist?list=PLQwpPWOYg4MOLr9lUNMBgjCCV0ifkKMDu"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "playlists": [
    {
      "playlistId": "PLQwpPWOYg4MOLr9lUNMBgjCCV0ifkKMDu",
      "playlistTitle": "Sermon Series Name",
      "playlistUrl": "https://www.youtube.com/playlist?list=...",
      "seriesName": "Sermon Series Name",
      "videoCount": 10,
      "matchedSermonCount": 8,
      "sermonIds": ["uuid1", "uuid2", ...]
    }
  ],
  "summary": {
    "totalPlaylists": 1,
    "matchedPlaylists": 1,
    "totalMatchedSermons": 8
  }
}
```

## How Series Are Organized

### Priority Order:

1. **Playlist-based** (highest priority)
   - Sermon's `youtube_video_id` matches a video in a playlist
   - Series name = Playlist title (cleaned)

2. **Title extraction** (fallback)
   - Extract series name from sermon title
   - Patterns: "Series Name - Part 1", "Part 1: Series Name", etc.

3. **Ungrouped** (if no match)
   - Sermons that don't match any playlist or title pattern
   - Still displayed in the catalog

## Example

If you have a YouTube playlist called **"Faith in Action - 2025"** with 10 videos:
- All 10 videos that match sermons in your database will be grouped under the series **"Faith in Action - 2025"**
- Series will show: 10 sermons, transcript count, date range
- Series name comes from playlist title (not extracted from video titles)

## Benefits

- ✅ **Accurate Organization**: Uses YouTube's playlist structure (the source of truth)
- ✅ **Automatic**: No manual series assignment needed
- ✅ **Consistent**: Series names match exactly what's on YouTube
- ✅ **Flexible**: Can add/remove playlists easily
- ✅ **Fallback**: Still works with title extraction for non-playlist sermons

## Future Enhancements

- [ ] Auto-discover all playlists from the channel
- [ ] Store playlist series info in database for faster loading
- [ ] UI to add/manage playlists
- [ ] Sync playlists automatically on catalog sync
- [ ] Support for multiple playlists per sermon (sermon could be in multiple series)
