# Environment Variables to Copy to Vercel

Copy these values from your `.env.local` file to Vercel:

## File Location
Your local file: `/Users/garytaylor/Documents/fxtranscriptor/.env.local`

## Variables to Copy

### 1. NEXT_PUBLIC_SUPABASE_URL
```
https://mfzrunlgkpbtiwuzmivq.supabase.co
```

### 2. NEXT_PUBLIC_SUPABASE_ANON_KEY
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1menJ1bmxna3BidGl3dXptaXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNzExOTcsImV4cCI6MjA4MzY0NzE5N30.0t5wve3InEVRGev5i_FwTohcxvZ_rmo4QwWTULv5RSc
```

### 3. SUPABASE_SERVICE_ROLE_KEY
```
YOUR_SUPABASE_SERVICE_ROLE_KEY
```
Keep this secret. Do not expose it in client-side code.

### 4. PODBEAN_RSS_URL (Optional)
```
https://feed.podbean.com/fxtalk/feed.xml
```

### 5. YOUTUBE_CHANNEL_ID (Optional)
```
@fxchurch
```

## Quick Copy Steps

1. Go to: https://vercel.com/dashboard
2. Select your project → **Settings** → **Environment Variables**
3. Click **"Add New"** for each variable above
4. Select environments: **Production**, **Preview**, **Development**
5. Click **"Save"**
6. **Redeploy** your project

## Or Use Vercel CLI

```bash
# Install CLI
npm i -g vercel

# Login
vercel login

# Link project
vercel link

# Add each variable (will prompt for value)
vercel env add NEXT_PUBLIC_SUPABASE_URL production preview development
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production preview development
vercel env add PODBEAN_RSS_URL production preview development
vercel env add YOUTUBE_CHANNEL_ID production preview development

# Redeploy
vercel --prod
```
