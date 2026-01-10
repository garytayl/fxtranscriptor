# Supabase Setup Instructions

## Step 1: Create Supabase Project

1. Go to https://supabase.com and sign up (free tier is fine)
2. Click "New Project"
3. Fill in:
   - **Name**: `fxtranscriptor` (or whatever you want)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to you
4. Click "Create new project"
5. Wait ~2 minutes for project to initialize

## Step 2: Get API Keys

1. In your Supabase project dashboard, go to **Settings** > **API**
2. Copy these two values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

## Step 3: Run Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy and paste the entire contents of `supabase/schema.sql`
4. Click "Run" (or press Cmd/Ctrl + Enter)
5. You should see "Success. No rows returned"

## Step 4: Set Environment Variables

Create a file called `.env.local` in the project root (same level as `package.json`):

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Podcast Configuration (optional - defaults are set)
PODBEAN_RSS_URL=https://fxtalk.podbean.com/feed/
YOUTUBE_CHANNEL_ID=@fxchurch
```

**Important**: 
- Add `.env.local` to `.gitignore` (it's already there)
- Never commit your `.env.local` file to Git
- On Vercel, add these as environment variables in project settings

## Step 5: Test Connection

After setting up, the app will automatically use Supabase. Check the browser console for any connection errors.

## Troubleshooting

**"Supabase client not initialized"**: 
- Check that `.env.local` exists and has correct values
- Restart your dev server after adding env vars

**"RLS policy violation"**: 
- Make sure you ran the schema.sql file completely
- Check that RLS policies were created (in SQL Editor, check `sermons` and `sermon_sources` tables)

**"Table does not exist"**:
- Make sure you ran `schema.sql` in the Supabase SQL Editor
- Check the Table Editor to see if `sermons` and `sermon_sources` tables exist
