# FX Transcriptor

A Next.js web app that extracts clean, copyable transcripts from Apple Podcasts episodes and other podcast sources.

## Features

- 🎙️ **Simple URL Input** - Just paste an Apple Podcasts episode URL
- 📝 **Clean Transcripts** - Automatically cleaned and formatted text
- 📋 **Copy All** - One-click copy to clipboard
- 💾 **Download** - Save transcripts as `.txt` files
- 🔄 **Tiered Extraction** - Multiple fallback strategies for maximum compatibility
- 🚀 **Vercel-Ready** - Optimized for serverless deployment

## How It Works

The app uses a **tiered extraction strategy**:

1. **Primary**: Attempts to locate and fetch transcript files (VTT, JSON, text)
2. **Secondary**: Parses WebVTT format if found
3. **Tertiary**: Extracts from RSS feed metadata
4. **Fallback**: Best-effort HTML extraction
5. **Cleanup**: Removes timestamps, normalizes formatting

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

1. Navigate to an Apple Podcasts episode page
2. Copy the URL from your browser
3. Paste it into the FX Transcriptor input field
4. Click "Fetch Transcript"
5. Copy or download the clean transcript

## Error Handling

If a transcript cannot be extracted, the app will display a clear error message. Common reasons:

- Episode doesn't have a publicly accessible transcript
- Transcript is behind authentication
- Network timeout or server error

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
