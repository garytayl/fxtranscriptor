# Bible Reader (API.Bible)

## Environment variables

Set these in `.env.local` (local) or Vercel project settings:

- `API_BIBLE_KEY` - API.Bible key (server-side only).
- `API_BIBLE_BIBLE_ID` - Bible/translation ID to use.
- `API_BIBLE_BASE_URL` - Base API URL. Default: `https://api.scripture.api.bible/v1`.

## Choosing a Bible ID

1. Use the API.Bible `GET /bibles` endpoint from their docs to find your preferred translation.
2. Copy the `id` value for that translation.
3. Set `API_BIBLE_BIBLE_ID` to that value.

## Endpoints used

Internal API routes (server-only, no key exposure):

- `GET /api/bible/books`
  - Returns the list of books with slugs and testament grouping.
- `GET /api/bible/book/<bookId>/chapters`
  - Returns chapter numbers for a given book.
- `GET /api/bible/chapter?book=<bookId>&chapter=<n>`
  - Returns chapter content and parsed verses for a given book + chapter.

## Caching

All API.Bible requests are cached for 1 hour via Next.js fetch revalidation.

## Reader routes

- `/bible` - list books
- `/bible/[bookSlug]` - list chapters
- `/bible/[bookSlug]/[chapterNumber]` - read chapter
  - Optional verse highlight: `?v=16-18`
