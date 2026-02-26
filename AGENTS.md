# AGENTS.md

## Cursor Cloud specific instructions

### Project overview
fxarchives is a Next.js 16 (App Router) sermon transcript archive app. See `README.md` for full feature list and architecture.

### Services

| Service | Required | How to run |
|---|---|---|
| Next.js App | Yes | `npm run dev` (port 3000) |
| Audio Worker | No | `cd worker && npm install && npm run dev` (port 8080, needs ffmpeg + yt-dlp) |

The app connects to a cloud-hosted Supabase instance (credentials hardcoded as fallbacks in `lib/supabase.ts`). No local database setup needed for basic dev work.

### Key commands
- **Dev server**: `npm run dev`
- **Lint**: `npm run lint` (ESLint v8 with `next/core-web-vitals` via `.eslintrc.json`)
- **Test**: `npm run test` (Vitest — runs `tests/**/*.test.ts`)
- **Build**: `npm run build`

### Gotchas
- The project has `"lint": "eslint ."` in `package.json` but `eslint` and `eslint-config-next` are not in the committed dependencies. They must be installed via `npm install --save-dev eslint@8 eslint-config-next@14` to make `npm run lint` work with the `.eslintrc.json` format.
- Next.js 16 removed the built-in `next lint` command; linting is done via `eslint .` directly.
- The `interface/` directory is an unused v0/shadcn UI template excluded from `tsconfig.json` — ignore it.
- The `worker/` directory is a separate npm project with its own `package.json`; it is optional and only needed for audio chunking of long sermons.
- External API features (Bible reader, AI summaries, Whisper transcription) require their respective API keys in `.env.local` — see `.env.example`.
- The app uses a deprecated `middleware.ts` file; Next.js 16 warns about migrating to `proxy` convention.
