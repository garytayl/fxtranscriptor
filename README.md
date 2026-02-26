# fxarchives

A modern sermon transcript archive for fxchurch. Automatically syncs sermons from Podbean and YouTube, with one-click transcript generation that's shared across all users.

## ✨ Features

- 📚 **Automatic Catalog** - Syncs all 818+ sermons from Podbean RSS and YouTube channel
- 🔄 **Smart Deduplication** - Matches sermons across platforms (no duplicates)
- 🎬 **Multi-Source** - Extracts transcripts from YouTube (auto-captions) or Podbean
- 💾 **Persistent Storage** - Transcripts stored in Supabase (shared across all users)
- ⚡ **Generate Once** - Click "Generate" once per sermon, all users see it
- 🎨 **Beautiful UI** - Dark, monochrome design with orange accents (interface template)
- 📋 **Copy & Download** - Easy transcript copying and .txt downloads
- 📖 **Scripture Reader** - Ad-free Bible reader powered by API.Bible

## 🚀 Quick Start

### 1. Supabase Setup (Already Done ✅)

- Project URL: `https://mfzrunlgkpbtiwuzmivq.supabase.co`
- Credentials are configured in code

**Next Step**: Run the database schema:
1. Go to: https://supabase.com/dashboard/project/mfzrunlgkpbtiwuzmivq/sql
2. Click "New Query"
3. Copy and paste the entire contents of `supabase/schema.sql`
4. Click "Run" (Cmd/Ctrl + Enter)

### 2. Environment Variables (Optional)

Create `.env.local` in the project root (optional - defaults are set):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://mfzrunlgkpbtiwuzmivq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
PODBEAN_RSS_URL=https://feed.podbean.com/fxtalk/feed.xml
YOUTUBE_CHANNEL_ID=@fxchurch
API_BIBLE_KEY=your-api-bible-key
API_BIBLE_BIBLE_ID=your-bible-id
API_BIBLE_BASE_URL=https://api.scripture.api.bible/v1
```

**Note**: The app will work with hardcoded values, but using `.env.local` is recommended for production.

### 3. Run the App

```bash
npm install
npm run dev
```

Visit http://localhost:3000

### 4. Sync Your Catalog

1. Click **"Sync Catalog"** button in the UI
2. The app will fetch all episodes from:
   - Podbean RSS: https://feed.podbean.com/fxtalk/feed.xml (818 episodes)
   - YouTube Channel: @fxchurch
3. Sermons are matched and deduplicated automatically

### 5. Generate Transcripts

1. Click **"Generate Transcript"** on any sermon card
2. The app tries YouTube first (auto-captions), then Podbean
3. Once generated, the transcript is stored permanently
4. All users can view it immediately (no need to regenerate)

## 🎯 How It Works

### Catalog Sync Flow

1. **Fetch Sources**:
   - Podbean RSS feed → Parse all episodes
   - YouTube channel → Parse all videos

2. **Match & Deduplicate**:
   - Title-based matching algorithm
   - Combines Podbean + YouTube into single sermon entries
   - No duplicates in the catalog

3. **Store in Database**:
   - Each sermon stored once with all source URLs
   - Status tracked: `pending` → `generating` → `completed` / `failed`

### Transcript Generation Flow

1. **User clicks "Generate"** on a sermon card
2. **Priority extraction**:
   - 🥇 YouTube URL (if available) → Auto-generated captions
   - 🥈 Podbean URL (if YouTube fails) → Episode page extraction
   - 🥉 Apple Podcasts (fallback) → Limited success

3. **Store & Share**:
   - Transcript saved to Supabase
   - Status updated to `completed`
   - All users can immediately view/copy/download

## 📊 Database Schema

- **`sermons`** - Main catalog table
  - Stores sermon metadata, transcript, status
  - Links to Podbean and YouTube URLs
  
- **`sermon_sources`** - Source tracking
  - Tracks where each sermon came from
  - Prevents duplicate entries across platforms

See `supabase/schema.sql` for full schema.

## 🎨 UI Features

- **Grid Layout** - Responsive 3-column sermon cards
- **Status Badges** - Visual status indicators (Pending/Generating/Completed/Failed)
- **Source Badges** - Shows transcript source (YouTube/Podbean/Generated)
- **Modal Transcript Viewer** - Large dialog for reading transcripts
- **Copy & Download** - One-click actions for transcripts
- **Loading States** - Skeleton loaders and spinner animations
- **Error Handling** - Clear error messages with retry options

## 🔧 Technical Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS v4 + Interface template (dark, monochrome)
- **Icons**: Lucide React
- **UI Components**: Custom shadcn/ui-based components
- **Fonts**: IBM Plex Sans/Mono, Bebas Neue

## 📝 API Routes

- `GET /api/catalog/sync` - Fetch and sync sermons from sources
- `GET /api/catalog/list` - Get all sermons from database
- `POST /api/catalog/generate` - Generate transcript for a sermon
- `POST /api/transcript` - Legacy URL-based transcript extraction

## 🚢 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables (optional - defaults work)
4. Deploy!

The app is fully configured for Vercel serverless functions.

### Environment Variables for Vercel

```
NEXT_PUBLIC_SUPABASE_URL=https://mfzrunlgkpbtiwuzmivq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
PODBEAN_RSS_URL=https://feed.podbean.com/fxtalk/feed.xml
YOUTUBE_CHANNEL_ID=@fxchurch
API_BIBLE_KEY=your-api-bible-key
API_BIBLE_BIBLE_ID=your-bible-id
API_BIBLE_BASE_URL=https://api.scripture.api.bible/v1
```

## 🎯 Usage

### First Time Setup

1. ✅ Run `supabase/schema.sql` in Supabase SQL Editor
2. ✅ (Optional) Create `.env.local` with credentials
3. ✅ Deploy to Vercel or run `npm run dev`
4. ✅ Click "Sync Catalog" to load all sermons
5. ✅ Click "Generate Transcript" on any sermon to create transcripts

### Daily Use

- **View Catalog**: All sermons listed automatically
- **Generate**: Click "Generate" on any sermon (once per sermon)
- **View Transcript**: Click "View Transcript" on completed sermons
- **Sync**: Click "Sync Catalog" to fetch new episodes (run periodically)

## 📋 Source Configuration

- **Podbean**: https://feed.podbean.com/fxtalk/feed.xml (confirmed)
- **YouTube**: @fxchurch (confirmed)

These are hardcoded defaults but can be overridden with environment variables.

## 🔒 Privacy & Security

- All sermons are publicly readable (RLS allows SELECT for everyone)
- Transcript generation requires no authentication
- Supabase anon key is safe for client-side use (RLS enforced)

## 🐛 Troubleshooting

**"No sermons in catalog"**:
- Run `supabase/schema.sql` first
- Click "Sync Catalog" button
- Check browser console for errors

**"Transcript generation failed"**:
- Check if sermon has YouTube URL (most reliable)
- Check if sermon has Podbean URL (fallback)
- Some episodes may not have transcripts available

**"Sync failed"**:
- Verify RSS feed URL is accessible
- Check YouTube channel handle is correct
- Check Supabase connection (credentials)

## 📚 Next Steps

- [ ] Run `supabase/schema.sql` in Supabase
- [ ] Deploy to Vercel
- [ ] Add environment variables (optional)
- [ ] Sync catalog
- [ ] Start generating transcripts!

---

Built with ❤️ for fxchurch
