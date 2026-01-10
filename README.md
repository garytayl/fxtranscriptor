# FX Transcriptor

A Next.js web app that extracts clean, copyable transcripts from multiple podcast and video sources using a **multi-source aggregation strategy**.

## Features

- 🎬 **YouTube Support** - Auto-extracts captions from YouTube videos (most reliable)
- 🎙️ **Podbean Support** - Extracts transcripts from Podbean episodes
- 📝 **Clean Transcripts** - Automatically cleaned and formatted text
- 📋 **Copy All** - One-click copy to clipboard
- 💾 **Download** - Save transcripts as `.txt` files
- 🔄 **Multi-Source Strategy** - Automatically selects best available transcript source
- 🚀 **Vercel-Ready** - Optimized for serverless deployment
- 📊 **Source Tracking** - Shows which source was used (YouTube/Podbean/Apple)

## How It Works

The app uses a **priority-based multi-source strategy**:

### 🥇 Priority 1: YouTube (Most Reliable)
- Auto-generated captions available for most videos
- Parses YouTube's caption tracks from video pages
- Converts captions to clean paragraph text

### 🥈 Priority 2: Podbean (Primary Podcast Host)
- Extracts transcripts from Podbean episode pages
- Falls back to RSS feed metadata if available
- Captures audio URL for future Whisper fallback

### 🥉 Priority 3: Apple Podcasts (Limited)
- Metadata-only pages, usually no transcripts
- Attempts VTT file detection and RSS feed parsing
- Provides helpful error messages directing to better sources

### 🎯 Fallback: Generic HTML Extraction
- Best-effort extraction from any HTML page
- Useful for custom podcast hosts

All extraction happens **server-side** to avoid CORS issues.

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## Deployment to Vercel

1. Push your code to GitHub
2. Import the repository in Vercel
3. Vercel will automatically detect Next.js and configure settings
4. Deploy!

The app is configured for Vercel's serverless functions with Node.js runtime.

## Usage

### Best Results (Recommended)
1. **YouTube Video URL** - Paste any YouTube video URL (auto-generated captions)
2. **Podbean Episode URL** - Paste a Podbean episode page URL
3. Click "Fetch Transcript"
4. Copy or download the clean transcript

### Supported URLs
- YouTube: `https://youtube.com/watch?v=...` or `https://youtu.be/...`
- Podbean: `https://fxtalk.podbean.com/...`
- Apple Podcasts: `https://podcasts.apple.com/...` (limited success)

### Why YouTube Works Best
YouTube auto-generates captions for most videos, making it the **most reliable source** for transcripts. Even if your podcast is primarily hosted on Podbean, if episodes are also posted to YouTube, use the YouTube URL for best results.

## Error Handling

If a transcript cannot be extracted, the app will display a clear error message with suggestions. Common scenarios:

- **Podbean**: Transcript may need to be manually generated on Podbean first
- **Apple Podcasts**: Pages are metadata-only; try YouTube or Podbean URL instead
- **YouTube**: Video may not have captions enabled (rare for public videos)
- **Network errors**: Server timeout or unreachable host

The app shows which source it attempted and provides helpful suggestions for alternatives.

## Architecture

```
/app
  /api/transcript/route.ts    # POST endpoint for transcript extraction
  /page.tsx                   # Main UI component
/lib
  fetchTranscript.ts          # Orchestrator (tiered strategy)
  extractFromVTT.ts          # WebVTT parser
  extractFromHTML.ts         # HTML extraction fallback
  extractFromRSS.ts          # RSS feed extraction
  cleanTranscript.ts         # Text normalization
```

## Technical Stack

- **Framework**: Next.js 16 (App Router)
- **Runtime**: Node.js (for flexible server-side fetching)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **TypeScript**: Full type safety

## Limitations

- Transcripts must be publicly accessible
- Some podcasts may not have transcripts available
- Large transcripts may take longer to process (15s timeout)

## License

MIT
