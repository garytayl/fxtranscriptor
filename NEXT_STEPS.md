# Almost There! Next Steps

## ✅ What You've Provided

- ✅ Supabase Project URL: `https://mfzrunlgkpbtiwuzmivq.supabase.co`
- ✅ Podbean RSS: `https://feed.podbean.com/fxtalk/feed.xml`
- ✅ YouTube Channel: `@fxchurch`

## 🔑 What You Still Need

### 1. Get Your Supabase Anon Key

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/mfzrunlgkpbtiwuzmivq
2. Navigate to **Settings** → **API** (left sidebar)
3. Find the **Project API keys** section
4. Copy the **`anon` `public`** key (it's a long string starting with `eyJ...`)
5. Replace `YOUR_ANON_KEY_HERE` in `.env.local` with this key

### 2. Run the Database Schema

1. In Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Open the file `supabase/schema.sql` in this project
4. Copy the entire contents
5. Paste into the SQL Editor
6. Click **"Run"** (or press Cmd/Ctrl + Enter)
7. You should see: "Success. No rows returned"

This creates:
- `sermons` table (stores all sermon data and transcripts)
- `sermon_sources` table (tracks Podbean/YouTube sources for deduplication)
- Indexes for performance
- Row Level Security policies (public read access)

### 3. Add to Vercel (for production)

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add these variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://mfzrunlgkpbtiwuzmivq.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (your anon key)
   - `PODBEAN_RSS_URL` = `https://feed.podbean.com/fxtalk/feed.xml`
   - `YOUTUBE_CHANNEL_ID` = `@fxchurch`

## 🚀 After Setup

Once you've added the anon key to `.env.local`:

1. **Restart your dev server** (if running)
2. **Test the connection** - I'll build the catalog UI next
3. **Sync your catalog** - Fetch all 818 Podbean episodes + YouTube videos
4. **Generate transcripts** - Click "Generate" for any sermon (once per sermon)

## 📋 Quick Test

After setup, you can test the API endpoints:

```bash
# Test catalog sync (fetch from Podbean + YouTube)
curl http://localhost:3000/api/catalog/sync

# Test catalog list (get all sermons from database)
curl http://localhost:3000/api/catalog/list
```

## 🎯 What I'll Build Next

Once you confirm the anon key is added, I'll:
1. ✅ Build the beautiful catalog UI (sermon list)
2. ✅ Add "Sync Catalog" button
3. ✅ Add "Generate Transcript" buttons for each sermon
4. ✅ Show sermon status (pending/generating/completed)
5. ✅ Display transcripts once generated

Just add the anon key and let me know when ready! 🚀
