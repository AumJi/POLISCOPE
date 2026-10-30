# POLISCOPE

POLISCOPE is a small full-stack political news briefing MVP for YWC: **เข้าใจข่าวการเมืองในไม่กี่นาที**.

It fetches Thai politics articles from Currents API, stores normalized records in Supabase PostgreSQL, exposes verified party relationships, and can stream a neutral Thai summary from Typhoon AI.

## Features

- Thai political news ingestion from Currents v2 Search (`country=TH`, `language=th`, `category=politics_government`, `page_size=10`)
- Explicit category and language validation before an article is stored; the database keeps the existing `politics` category used by feed and analytics queries
- Optional, opt-in RSS adapter for configured Thai publisher feeds; RSS items must carry an explicit political category and are never scraped beyond the feed response
- Cursor-based ingestion of up to `NEWS_MAX_PAGES` pages per manual/cron run, with the homepage limited to one refresh page
- URL/provider-ID deduplication and a 15-minute in-memory refresh cache
- Protected Vercel Cron ingestion plus `npm run ingest:news` for manual collection
- PostgreSQL persistence for sources, articles, summaries, parties, and reviewed article-party relationships
- Candidate-constrained Typhoon party extraction using seeded party names, short names, and explicitly verified aliases
- Party filtering with `GET /api/news?party=PARTY_CODE`
- Reviewed-only party counts and article relationships in public responses
- Manual review SQL workflow for approving pending article-party suggestions
- Typhoon streaming summaries over POST + Server-Sent Events
- SHA-256 summary input hashing and database cache reuse
- Responsive React/Vite dashboard with search, filters, skeletons, empty/error states, article details, source links, and AI disclaimer
- `/analytics` dashboard with PostgreSQL-backed KPIs, Bangkok-time timeline, party/source counts, keyword topics, trend comparison, filters, and article drill-down

## Architecture

```text
React/Vite (dist) ── same-origin /api/* ── Express Function
                                             ├── Currents API (preferred)
                                             ├── Optional RSS feeds
                                             ├── NewsData.io (legacy)
                                             ├── Typhoon AI
                                             └── Supabase PostgreSQL
```

The browser never receives `DATABASE_URL`, `CURRENTS_API_KEY`, `NEWS_API_KEY`, or `TYPHOON_API_KEY`. The application does not automatically execute `database/schema.sql`; the existing database remains authoritative.

## Requirements

- Node.js 22 or newer
- npm
- Existing Supabase PostgreSQL database with the expected tables
- Currents API key for preferred live ingestion
- Typhoon API key for live summaries

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in the server values:

   ```env
   DATABASE_URL=postgresql://...
   NEWS_PROVIDER=currents
   CURRENTS_API_KEY=...
   RSS_FEEDS=
   NEWS_API_KEY=... # only when NEWS_PROVIDER=newsdata
   NEWS_MAX_PAGES=3
   TYPHOON_API_KEY=...
   TYPHOON_MODEL=typhoon-v2.5-30b-a3b-instruct
   CRON_SECRET=...
   ```

   Use the Supabase pooler connection string for hosted/serverless environments. Never commit `.env`.

3. Start the frontend and API together:

   ```bash
   npm run dev
   ```

   - Frontend: `http://localhost:5173`
   - API: `http://localhost:3000`
   - Vite proxies `/api` to the Express server.

## Commands

```bash
npm install       # install dependencies
npm run dev       # Vite + Express development servers
npm run build     # production frontend build in dist/
npm test          # mocked/unit/API tests
npm run ingest:news # manually collect up to NEWS_MAX_PAGES provider pages
npm run retag:parties # backfill political-party suggestions for stored political articles
```

## Database

- `database/schema.sql` is a version-controlled reference only.
- `database/migrations/001_analytics_indexes.sql` is a review-before-apply, non-destructive migration. It is not executed by the application.
- `database/manual-party-tagging.sql` is a placeholder-based manual tagging template. Replace its values only after verifying the article text and party relationship.
- `database/review-party-association.sql` approves an existing `is_reviewed = false` suggestion by exact article URL and party code. It does not create new associations.
- Party candidates are loaded from `political_parties`; Typhoon receives only those candidates and the article text. The backend accepts only existing party codes, allowed relation types, and evidence traceable to the supplied text. It never creates party rows from AI output.
- `npm run retag:parties` processes existing political articles sequentially. It writes only `is_reviewed = false` AI suggestions and preserves reviewed associations. The normal ingestion path only sends newly inserted articles to Typhoon, so page opens do not repeat tagging calls.
- The public news request does not wait for Typhoon tagging; scheduled/manual ingestion performs the slower AI tagging workflow so the feed remains responsive.
- No migration or startup script drops, overwrites, or automatically alters existing tables.

Expected relationships:

- `news_sources 1:N articles`
- `articles 1:N ai_summaries`
- `articles M:N political_parties` through `article_parties`

## API

### `GET /api/health`

Returns service status and boolean configuration flags. It never returns secret values.

### `GET /api/news?party=PARTY_CODE`

Refreshes the provider feed when the 15-minute cache is stale, reads normalized articles from PostgreSQL, and returns only reviewed party relationships.

### `GET /api/parties`

Returns the political party catalog from PostgreSQL with `articleCount` based only on distinct reviewed political article associations.

### `POST /api/summarize`

Request body:

```json
{ "articleId": "uuid" }
```

The response is `text/event-stream` with `delta`, `complete`, or `error` events. Successful summaries are persisted only after the full stream completes. Cached summaries use the same SSE contract and are marked `cached: true`.

### Analytics endpoints

- `GET /api/analytics/overview?range=7d|30d`
- `GET /api/analytics/timeline?range=7d|30d`
- `GET /api/analytics/parties?range=7d|30d`
- `GET /api/analytics/sources?range=7d|30d`
- `GET /api/analytics/topics?range=7d|30d`

Analytics are calculated from collected PostgreSQL records. Timeline grouping uses `Asia/Bangkok`; party counts use only reviewed `article_parties` rows; topic results are keyword-frequency analysis from headlines, not verified event clustering.

### `GET /api/cron/ingest`

The scheduled endpoint requires `Authorization: Bearer $CRON_SECRET`. It is configured in `vercel.json` for `0 2 * * *` (09:00 Bangkok time). The endpoint is not a public write API.

## Vercel deployment

The repository is prepared for the existing Vercel project `poliscope-ywc-react`:

- `dist/` is the Vite output directory.
- `api/index.js` exposes the Express application as the server function.
- `vercel.json` routes `/api/*` to Express and all other paths to the React entrypoint.
- Add `DATABASE_URL`, `NEWS_PROVIDER=currents`, `CURRENTS_API_KEY`, `TYPHOON_API_KEY`, and `TYPHOON_MODEL` as server-side Vercel environment variables.
- Set `RSS_FEEDS` only when deliberately using `NEWS_PROVIDER=rss`; set `NEWS_API_KEY` only when deliberately using the legacy `NEWS_PROVIDER=newsdata` adapter.
- Add `CRON_SECRET` and optionally `NEWS_MAX_PAGES` as server-side Vercel environment variables.
- Use the Supabase pooler URL and keep secrets out of Vite client variables.
- Verify the project’s root directory is this repository and the framework/build settings match `npm run build` and `dist`.

This repository does not deploy or push automatically. Before a release, run the local checks, then use the already-linked Vercel project and verify `/api/health`, `/api/news`, and a streamed summary in a preview deployment.

Vercel Hobby cron is configured once per day. Currents Free request and result quotas limit how much history can be collected per run. The analytics dashboard reports only articles actually stored in PostgreSQL; a “30-day” view means collected articles published within the last 30 days, not all news published during that period. Trend comparison remains disabled until the database covers at least 14 calendar days.

Reference: [Vercel Vite deployment](https://vercel.com/docs/frameworks/frontend/vite), [Vercel Express deployment](https://vercel.com/docs/frameworks/backend/express), and [Vercel build configuration](https://vercel.com/docs/builds/configure-a-build).

## News provider notes

Currents v2 is the preferred provider because its Search API documents the `politics_government` taxonomy, Thai language filtering, and cursor pagination. The application does not silently replace Thai results with international results when the provider returns too few articles. Verify actual Thai volume with `npm run ingest:news` after adding a Currents key. The free plan may return only a limited text preview, so POLISCOPE preserves the provider's available `description`/`content` and keeps the original source link.

NewsData remains available only as an explicit legacy adapter (`NEWS_PROVIDER=newsdata`). The current application does not request NewsData `full_content=1`; a paid-plan error from that feature or from the account is not treated as a reason to mix providers. RSS is a separate explicit adapter (`NEWS_PROVIDER=rss`, `RSS_FEEDS=url1,url2`) and accepts only feed items with an explicit political category.

## Verification status

Mocked provider, hashing, streaming, query, refresh-policy, and HTTP validation tests are included. Live Currents, RSS, Supabase, Typhoon, and Vercel deployment verification require the corresponding credentials and explicit deployment approval.
