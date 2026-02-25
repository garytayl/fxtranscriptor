# Bible Verse References & API.Bible Usage

How verses are referenced in the app and how we use the [API.Bible](https://scripture.api.bible) (scripture.api.bible) API.

---

## 1. Verse reference format

### String format

References are **book + chapter + optional verse(s)**:

| Pattern | Example | Meaning |
|--------|---------|--------|
| `Book Chapter` | `John 3` | Whole chapter |
| `Book Chapter:Verse` | `John 3:16` | Single verse |
| `Book Chapter:Start-End` | `John 3:16-18` | Verse range |

- **Book**: Any book name the API recognizes (e.g. `John`, `1 John`, `Psalms`). Normalized (e.g. `Psalm` → `Psalms`).
- **Chapter**: Integer.
- **Verse**: Integer, or `Start-End` for a range.

**List of passages** (search / builder): separate with **semicolons** or **newlines**, e.g. `John 3:16-18; Romans 8:1`. Comma can denote “same book/chapter” shorthand: `John 3:16, 18` → `John 3:16` and `John 3:18`.

### Internal types (`lib/bible/reference.ts`)

```ts
// Single verse or range (e.g. "16" or "16-18")
type VerseRange = { start: number; end: number }

// One passage: book + chapter + optional verse range
type PassageReference = {
  raw: string           // normalized input, e.g. "John 3:16-18"
  book: string          // canonical name, e.g. "John"
  bookSlug: string       // URL slug, e.g. "john"
  chapterNumber: number
  verseRange: VerseRange | null  // null = whole chapter
}
```

### Parsing functions

| Function | Purpose |
|----------|--------|
| `parseVerseRange(raw)` | Parses `"16"` or `"16-18"` → `VerseRange` or `null`. |
| `parsePassageReference(raw)` | Parses one reference string → `PassageReference` or `null`. Regex: `^(.+?)\s+(\d+)(?::(\d+(?:-\d+)?))?$` (book, chapter, optional verse/range). |
| `parsePassageList(raw)` | Splits on `;` or newline, expands comma shorthand, returns `PassageReference[]`. |
| `normalizeBookName(raw)` | Handles ordinals (First/1st/I → 1, etc.) and aliases (e.g. Psalm → Psalms). |
| `slugifyBookName(name)` | Lowercase, `&`→and, strip apostrophes, non-alphanumeric → `-`. |
| `isVerseInRange(verseNumber, range)` | Returns whether a verse number is inside a `VerseRange`. |

### URLs from references

| Function | Purpose |
|----------|--------|
| `getReaderUrlFromReference(raw, translationKey?)` | `/bible/{bookSlug}/{chapter}?v={verseOrRange}&t={translation}`. |
| `getReaderUrlFromVerse(verse, translationKey?)` | Same idea from a verse object `{ book, chapter, verse_start, verse_end }`. |

**Query params:**

- `v` – verse or range: `16` or `16-18` (for highlighting in reader).
- `t` – translation key (e.g. `default`, `esv`).

---

## 2. Bible API (API.Bible) usage

### Base URL and auth

- **Base URL**: `https://api.scripture.api.bible/v1` (override with `API_BIBLE_BASE_URL`; `/v1` is appended if missing).
- **Auth**: Header `api-key: <API_BIBLE_KEY>`.
- **Bible edition**: `API_BIBLE_BIBLE_ID` (e.g. `9879dbb7cfe39e4d-01` for ASV). Optional per-request `bibleId` overrides this (e.g. for translations).

### Environment variables

| Variable | Purpose |
|----------|--------|
| `API_BIBLE_KEY` | Required. API key from api.scripture.api.bible. |
| `API_BIBLE_BASE_URL` | Optional. Default `https://api.scripture.api.bible/v1`. |

**Two translations only (BSB + WEBU, recommended):**

| Variable | Purpose |
|----------|--------|
| `API_BIBLE_BSB_ID` | Bible ID for Berean Standard Bible. Must be from your key’s allowed list. |
| `API_BIBLE_WEBU_ID` | Bible ID for World English Bible (Updated). Must be from your key’s allowed list. |
| `API_BIBLE_DEFAULT_TRANSLATION` | Optional. `bsb` or `webu`. Defaults to first (BSB). |

Both IDs must be set. Get valid IDs by calling the API with your key (see **403 troubleshooting** below).

**Other modes:**

| Variable | Purpose |
|----------|--------|
| `API_BIBLE_BIBLE_ID` | Single default bible ID when not using BSB+WEBU or custom list. |
| `API_BIBLE_TRANSLATION_LABEL` | Label when using a single `API_BIBLE_BIBLE_ID`. |
| `API_BIBLE_TRANSLATIONS_JSON` | JSON array of `{ key, label?, bibleId }` (overrides BSB+WEBU if set). |
| `API_BIBLE_TRANSLATIONS` | CSV of `key:bibleId` (e.g. `default:xxx, esv:yyy`). |

### 403 Forbidden — "You are not authorized to access that bible"

Your API key can only use **bibles that are on your account’s plan**. IDs from docs or other projects may not be allowed.

1. List bibles your key can use — in the app, open **GET /api/bible/bibles** (e.g. `http://localhost:3000/api/bible/bibles`) or run:
   ```bash
   curl -s -H "api-key: YOUR_API_KEY" "https://api.scripture.api.bible/v1/bibles" | jq '.data[] | {id, name, abbreviation}'
   ```
2. Find the `id` for **Berean Standard Bible** (BSB) and **World English Bible** (or "World English Bible Updated" / WEBU). If a bible is missing, it isn’t on your plan (different tier or license).
3. Copy those **exact** `id` values into `.env` as `API_BIBLE_BSB_ID` and `API_BIBLE_WEBU_ID`. Restart the dev server after changing `.env`.
4. If you still get 403, ensure `API_BIBLE_TRANSLATIONS_JSON` and `API_BIBLE_TRANSLATIONS` are **not** set (so the app uses BSB+WEBU from env).

### Caching

- **TTL**: `BIBLE_CACHE_SECONDS = 3600` (1 hour).
- **Cached in memory**: book list per `bibleId`, bible info per `bibleId`.
- Fetch uses `next: { revalidate: BIBLE_CACHE_SECONDS }` for ISR.

### API calls we use (`lib/bible/api.ts`)

| Function | API path | Returns |
|----------|----------|--------|
| `listBooks(bibleId?)` | `GET /bibles/{bibleId}/books` | Raw book list from API. |
| `getBibleInfo(bibleId?)` | `GET /bibles/{bibleId}` | Bible name/description (cached). |
| `listChapters(bookId, bibleId?)` | `GET /bibles/{bibleId}/books/{bookId}/chapters` | Chapters as `BibleChapter[]` (id, number, reference). |
| `getChapterText(input, bibleId?)` | `GET /bibles/{bibleId}/chapters/{chapterId}?content-type=html&include-verse-numbers=true&include-verse-spans=true&include-notes=false&include-titles=true&include-chapter-numbers=false` | Full chapter HTML content. |
| `getChapterVerses(input, bibleId?)` | Same as above, then sanitize HTML and parse verses | `{ chapter: BibleChapterContent, verses: BibleVerse[] }`. |
| `getBooksWithSlugs(bibleId?)` | Uses `listBooks` + slug + testament | `BibleBook[]` with `slug`, `testament` (cached). |
| `getBookBySlug(slug, bibleId?)` | Uses `getBooksWithSlugs` | Single `BibleBook` or null (slug alias: `psalm` → `psalms`). |

**Resolving chapter**: If you pass `{ bookId, chapterNumber }`, the code loads `listChapters`, finds the chapter with that number, then fetches by `chapterId`.

### Chapter content → verses

1. API returns chapter **HTML** with verse spans (e.g. `<span class="v" data-number="1">1</span> ...`).
2. `sanitizeChapterHtml()` strips `<script>` and `<style>`.
3. `parseChapterHtmlToVerses()` in `lib/bible/parse.ts`:
   - Matches `<span ... class="... v ..." ...>(.*?)</span>`.
   - Uses `data-number` or the span content for verse number.
   - Takes text between verse spans as that verse’s text.
   - Decodes HTML entities and normalizes whitespace.
4. Result: `BibleVerse[]` with `{ number, text }`.

### Internal types (`lib/bible/types.ts`)

```ts
BibleBook     → id, name, nameLong?, abbreviation?, slug, testament
BibleChapter → id, number, reference?
BibleChapterContent → id, bookId, number, reference, content (HTML or sanitized)
BibleVerse   → number, text
```

---

## 3. Where references and the API are used

| Place | Use |
|-------|-----|
| **Reader** `/bible/[bookSlug]/[chapterNumber]` | `getBookBySlug`, `listChapters`, `getChapterVerses`. Query `v` → `parseVerseRange` for highlight; `isVerseInRange` to mark verses. |
| **Search** `/bible/search` | `parsePassageList` (and builder arrays). For each passage: `getBookBySlug`, `listChapters`, `getChapterVerses`, then filter verses by `verseRange` with `isVerseInRange`. |
| **API route** `GET /api/bible/passage?ref=...&t=...` | `parsePassageReference(ref)` → get book by slug, chapter, `getChapterVerses`, filter by `verseRange`, return `{ reference, verses, chapterReference }`. |
| **Studies** (e.g. inline passage, verse pills) | `getReaderUrlFromReference` for links; `/api/bible/passage?ref=...` for fetching text; `parsePassageReference` / `parsePassageList` for detecting and parsing refs in content. |

---

## 4. Greek and Hebrew word study (Strong’s)

Studies and the scripture reader can show **original-language word explanations** (Strong’s Concordance) so users can dive deeper into the text.

### In study guides (markdown)

Use a special link so a word becomes a hoverable “word study” with Greek/Hebrew lemma, transliteration, and definition:

- **Syntax**: `[display text](strong:G26)` or `[display text](strong:H3045)`
- **Codes**: `G` + number = Greek; `H` + number = Hebrew (Strong’s number).
- **Example**: `[love](strong:G26)` or `[agapē](strong:G26)` — hovering shows the Strong’s entry for ἀγάπη (agapē).

Definitions come from a local sample (`lib/bible/lexicon-data.ts`) and, when missing, from the full **OpenScriptures Strong's** dictionaries (Greek and Hebrew) fetched from jsDelivr and cached in memory. No API key required. API: `GET /api/bible/lexicon/[code]` returns one entry.

### In the scripture reader

- Each chapter page has a **“Dive deeper”** section at the bottom.
- If the chapter has **key terms** configured in `lib/bible/chapter-key-terms.ts`, those Strong’s codes are shown as hoverable word studies.
- Otherwise, the section still explains that study guides offer word-study links.

### Adding more terms

- **Lexicon**: Add entries to `LEXICON_SAMPLE` in `lib/bible/lexicon-data.ts` (format: `code`, `lemma`, `transliteration`, `pronunciation`, `meaning`, `definition?`, `language`).
- **Chapter key terms**: Add a key `"bookSlug-chapterNumber"` (e.g. `"john-3"`) to `CHAPTER_KEY_TERMS` in `lib/bible/chapter-key-terms.ts` with an array of Strong’s codes.

---

## 5. Summary

- **References**: `Book Chapter` or `Book Chapter:Verse` or `Book Chapter:Start-End`; lists with `;` or newline; comma for same-book shorthand.
- **Parsing**: `lib/bible/reference.ts` turns strings into `PassageReference` / `VerseRange` and builds reader URLs.
- **API**: API.Bible v1 with `api-key`; we call books, chapters, and chapter HTML; we parse HTML to `BibleVerse[]` and support multiple translations via `bibleId` and env config.
- **Word study**: Study guides use `[word](strong:G26)` links; reader shows a “Dive deeper” section with optional key terms from `lib/bible/chapter-key-terms.ts` and `lib/bible/lexicon-data.ts`.
