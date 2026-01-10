# What I Need From You

## ✅ Already Set Up

I've installed Supabase and created all the backend code for the catalog system. Here's what's ready:

- ✅ Supabase client setup
- ✅ Database schema (SQL file ready)
- ✅ Podbean RSS fetcher
- ✅ YouTube catalog fetcher  
- ✅ Sermon matching/deduplication logic
- ✅ API routes for sync, list, and generate

## 📋 What You Need to Provide

### 1. Supabase Credentials

**Steps:**
1. Create a free Supabase account at https://supabase.com
2. Create a new project
3. Get your **Project URL** and **anon key** from Settings > API
4. Run the `supabase/schema.sql` file in Supabase SQL Editor
5. Create `.env.local` file with:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

📖 **Detailed instructions**: See `SUPABASE_SETUP.md`

### 2. Podcast Source URLs (Optional - defaults provided)

If your RSS feed or YouTube channel are different from defaults, provide:

- **Podbean RSS URL**: ✅ Set to `https://feed.podbean.com/fxtalk/feed.xml` (confirmed)
  - No action needed - this is the correct feed URL

- **YouTube Channel**: Currently defaults to `@fxchurch`
  - ✅ If this is correct, no action needed
  - ❌ If different, add to `.env.local`:
    ```bash
    YOUTUBE_CHANNEL_ID=@your-channel-handle
    ```

### 3. Vercel Environment Variables

After setting up Supabase, add these to Vercel:

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - (Optional) `PODBEAN_RSS_URL`
   - (Optional) `YOUTUBE_CHANNEL_ID`

## 🚀 Once You Provide These

1. **I'll update the UI** to show the catalog instead of URL input
2. **You can sync the catalog** by calling `/api/catalog/sync`
3. **Sermons will appear** in a beautiful list with "Generate Transcript" buttons
4. **Once generated**, transcripts are stored permanently for all users

## 📝 Quick Start After Setup

1. Run the sync: `GET /api/catalog/sync` (or I can add a button in UI)
2. View catalog: `GET /api/catalog/list`
3. Generate transcript: `POST /api/catalog/generate` with `{ sermonId: "..." }`

## ❓ Questions?

Just provide:
- ✅ Supabase URL and anon key
- ✅ ~~Podbean RSS URL~~ (CONFIRMED: https://feed.podbean.com/fxtalk/feed.xml)
- ✅ ~~YouTube channel handle~~ (CONFIRMED: @fxchurch)

Then I'll finish the UI and we're done! 🎉
