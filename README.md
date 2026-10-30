# MARKETSCOPE

MARKETSCOPE is an educational investment intelligence dashboard for the YWC programming interview. It combines stored historical market observations, categorized investment news, source links, deterministic metrics, and neutral Thai Typhoon summaries.

It is not a trading system and does not provide personalized buy/sell recommendations.

## Features

- Dashboard for Gold/XAUUSD, WTI, USD/THB, AAPL, MSFT, and VOO ETF
- Historical daily prices stored in PostgreSQL; no provider call on page load
- 7d, 30d, and 90d price history
- Percentage change, observation-based SMA 7/SMA 30, and realized daily-return volatility
- Normalized comparison instead of comparing raw prices with different units
- Investment news feed with category validation, source attribution, and original links
- `article_assets` many-to-many relationships with unreviewed suggestions and manual review SQL
- Typhoon AI streaming summaries with SHA-256 caching and financial-risk disclaimers
- PostgreSQL-backed news volume, asset coverage, and keyword-frequency insights
- Responsive React/Vite interface at `/dashboard`, `/news`, and `/market/:symbol`

## Architecture

```text
React/Vite (dist) ── same-origin /api/* ── Express Function
                                      ├── Alpha Vantage (historical prices)
                                      ├── Currents v2 or configured RSS (investment news)
                                      ├── Typhoon AI (summaries only)
                                      └── Supabase PostgreSQL
```

Secrets are server-only. The browser never receives `DATABASE_URL`, `ALPHA_VANTAGE_API_KEY`, `CURRENTS_API_KEY`, or `TYPHOON_API_KEY`.

## Requirements

- Node.js 22 or newer
- npm
- Existing Supabase PostgreSQL database
- Migration `database/migrations/002_marketscope_market_data.sql` applied manually when the market tables are not already present

## Environment

Copy `.env.example` to `.env`:

```env
DATABASE_URL=postgresql://...
DATABASE_POOL_MAX=1
DATABASE_IDLE_TIMEOUT_MS=10000
ALPHA_VANTAGE_API_KEY=...
TYPHOON_API_KEY=...
TYPHOON_MODEL=typhoon-v2.5-30b-a3b-instruct
CRON_SECRET=...

# Investment news provider. Currents is preferred.
NEWS_PROVIDER=currents
CURRENTS_API_KEY=...
NEWS_CATEGORY=investment
NEWS_LANGUAGE=en
NEWS_COUNTRY=US
NEWS_MAX_PAGES=3
VITE_ENABLE_MARKET_DEMO_DATA=false

# Optional explicit RSS mode. Do not mix it silently with Currents.
RSS_FEEDS=
```

`NEWS_API_KEY` remains supported only for the previous explicit `NEWS_PROVIDER=newsdata` mode. Never commit `.env`.

For a local interview/demo environment only, set `VITE_ENABLE_MARKET_DEMO_DATA=true` to show clearly labeled deterministic mock price observations when PostgreSQL has no history for an asset. This never writes mock rows to `market_prices` and must remain `false` in production.

## Local development

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Express API: `http://localhost:3000`
- Vite proxies `/api/*` to Express.

Manual ingestion commands:

```bash
npm run ingest:markets
npm run ingest:news
npm test
npm run build
```

The ingestion commands require the relevant server credentials and a configured database. They do not fabricate prices or news. Market ingestion processes the six configured assets sequentially to reduce provider quota pressure.
Public `GET /api/news` and dashboard requests read saved PostgreSQL records only; they do not call Currents/RSS on every page view. New news is collected by the protected Vercel Cron endpoint or the local CLI command.

## Database

Existing tables are preserved:

- `news_sources`
- `articles`
- `ai_summaries`
- `political_parties`
- `article_parties`

MARKETSCOPE adds or reuses:

- `market_assets` — asset metadata and provider mapping
- `market_prices` — daily OHLCV observations keyed by `(asset_id, price_date)`
- `article_assets` — asset/article relationships keyed by `(article_id, asset_id)`

The live Supabase database was checked read-only during implementation. It already contains the six market asset metadata rows and zero market price rows/asset associations at that time. Existing market table columns are respected (`asset_class`, `currency_code`, `quote_unit`, `data_provider`, `open_price`, `close_price`, `retrieved_at`). No existing political data is deleted.

Run `database/review-asset-association.sql` after independently verifying a relationship. Public asset counts use `is_reviewed = true`; the news UI may show unreviewed suggestions with a visible pending label.

## APIs

### Service and news

- `GET /api/health`
- `GET /api/news?category=investment&asset=XAUUSD`
- `GET /api/news/:id?category=investment`
- `POST /api/summarize` with `{ "articleId": "uuid" }`
- `GET /api/cron/ingest` for protected investment news ingestion

### Markets

- `GET /api/markets`
- `GET /api/markets/:symbol/history?range=7d|30d|90d`
- `GET /api/markets/:symbol/analytics?range=7d|30d|90d`
- `GET /api/markets/cron/ingest` for protected price ingestion

### Analytics

- `GET /api/analytics/overview?range=7d|30d|90d`
- `GET /api/analytics/news-volume?range=7d|30d`
- `GET /api/analytics/asset-news?range=7d|30d`
- `GET /api/analytics/investment-topics?range=7d|30d`

The earlier political analytics routes remain mounted for existing records: `/timeline`, `/parties`, `/sources`, and `/topics`.

## Provider and data limitations

Alpha Vantage documents `GOLD_SILVER_HISTORY` for XAU, `WTI`, `FX_DAILY`, and `TIME_SERIES_DAILY` for equities and ETFs in its API documentation. The application handles provider `Information`, `Note`, invalid responses, missing observations, and empty history without inventing values. Actual access for the configured key must still be verified by running `npm run ingest:markets`; this repository does not claim live provider access from mocked tests.

Currents v2 is used for investment news by requesting its documented `economy_business_finance` category with the configured language and country filters. The default demo configuration is English/US because the live Thai finance result set was empty during verification; switch both values explicitly to `th`/`TH` when Thai coverage is available. Returned category and language fields are validated before storage. If Thai coverage is insufficient, use the explicit RSS adapter with supported publisher feeds in `RSS_FEEDS`; it accepts only feed items with an explicit finance/market category and never scrapes publisher pages. The application does not silently mix international news or scrape protected full text.

Free or entry-level providers may return excerpts rather than full article text, delayed observations, limited history, or quota errors. MARKETSCOPE preserves the available text, original URL, publication timestamp, and provider attribution. Analytics describe collected records only, not the complete market or news universe.

## Vercel

The existing Vercel project `poliscope-ywc-react` is preserved. `vercel.json` routes `/api/*` to `api/index.js`, serves the Vite `dist` output, preserves direct React route refreshes, and schedules protected news and market ingestion once per day. The Express app is exported as a Vercel Node.js Function; no persistent `server/index.js` process is started by Vercel.

For deployment:

```bash
npm install
npm test
npm run build
npx vercel link --yes --project poliscope-ywc-react
npx vercel pull --yes --environment=production
npx vercel deploy --prod --yes
```

Do not commit `.env`, `.env.local`, `.vercel`, or any pulled Vercel environment file. The Vercel dashboard must contain the server-side environment variables below for Production, Preview, and Cron as appropriate.

- `DATABASE_URL` using the Supabase pooler connection string
- `ALPHA_VANTAGE_API_KEY`
- `NEWS_PROVIDER`, `CURRENTS_API_KEY`, and optional `RSS_FEEDS`
- `TYPHOON_API_KEY`, `TYPHOON_MODEL`
- `CRON_SECRET`
- `DATABASE_POOL_MAX=1` and `DATABASE_IDLE_TIMEOUT_MS=10000` for the Supabase transaction pooler/serverless runtime

Use the Supabase transaction pooler connection string for `DATABASE_URL` (normally the pooler host/port, not a direct database connection). Keep the serverless pool small because each warm Vercel instance can create its own pool. The API uses SSL for Supabase URLs, parameterized queries, connection timeouts, and transactions for related writes.

Vercel Hobby cron schedules are limited and are not a substitute for a high-frequency market data system. News and market cron calls are protected by `CRON_SECRET`; unauthorized requests return `401`. The current function timeout is 120 seconds, while provider requests have their own shorter timeouts. Market ingestion stores successful assets even when another provider request fails.

## Verification status

Mocked provider, normalization, analytics, asset matching, streaming, API validation, and build checks are included. The latest local verification passed `npm test` with 69 tests and `npm run build`. Alpha Vantage, Currents, Typhoon, and Vercel live verification remain credential/deployment dependent unless explicitly tested against configured production services.
