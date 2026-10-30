-- MARKETSCOPE market data extension.
-- Review and run manually against the existing Supabase database.
-- This migration never drops or rewrites the POLISCOPE tables.

CREATE TABLE IF NOT EXISTS market_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  asset_type VARCHAR(32) NOT NULL,
  category VARCHAR(64) NOT NULL,
  provider_symbol VARCHAR(32),
  provider_function VARCHAR(64),
  quote_currency VARCHAR(16) NOT NULL,
  unit VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS market_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES market_assets(id) ON DELETE CASCADE,
  price_date DATE NOT NULL,
  open NUMERIC(20, 8),
  high NUMERIC(20, 8),
  low NUMERIC(20, 8),
  close NUMERIC(20, 8) NOT NULL,
  adjusted_close NUMERIC(20, 8),
  volume NUMERIC(24, 4),
  quote_currency VARCHAR(16) NOT NULL,
  unit VARCHAR(64) NOT NULL,
  source VARCHAR(64) NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (asset_id, price_date)
);

CREATE TABLE IF NOT EXISTS article_assets (
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES market_assets(id) ON DELETE CASCADE,
  relation_type VARCHAR(120) NOT NULL DEFAULT 'mentioned',
  tagging_method VARCHAR(120) NOT NULL DEFAULT 'name_match',
  is_reviewed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (article_id, asset_id)
);

CREATE INDEX IF NOT EXISTS market_prices_asset_date_idx ON market_prices (asset_id, price_date DESC);
CREATE INDEX IF NOT EXISTS article_assets_asset_reviewed_idx ON article_assets (asset_id, is_reviewed);
CREATE INDEX IF NOT EXISTS article_assets_article_reviewed_idx ON article_assets (article_id, is_reviewed);

INSERT INTO market_assets (
  symbol, name, asset_type, category, provider_symbol, provider_function, quote_currency, unit
)
VALUES
  ('XAU', 'Gold / XAUUSD', 'commodity', 'gold', 'XAU', 'GOLD_SILVER_HISTORY', 'USD', 'USD per troy ounce'),
  ('WTI', 'West Texas Intermediate', 'commodity', 'oil', 'WTI', 'WTI', 'USD', 'USD per barrel'),
  ('USDTHB', 'US Dollar / Thai Baht', 'forex', 'forex', 'USD/THB', 'FX_DAILY', 'THB', 'THB per USD'),
  ('AAPL', 'Apple Inc.', 'stock', 'stocks', 'AAPL', 'TIME_SERIES_DAILY', 'USD', 'USD per share'),
  ('MSFT', 'Microsoft Corporation', 'stock', 'stocks', 'MSFT', 'TIME_SERIES_DAILY', 'USD', 'USD per share'),
  ('VOO', 'Vanguard S&P 500 ETF', 'etf', 'funds', 'VOO', 'TIME_SERIES_DAILY', 'USD', 'USD per share')
ON CONFLICT (symbol) DO UPDATE SET
  name = EXCLUDED.name,
  asset_type = EXCLUDED.asset_type,
  category = EXCLUDED.category,
  provider_symbol = EXCLUDED.provider_symbol,
  provider_function = EXCLUDED.provider_function,
  quote_currency = EXCLUDED.quote_currency,
  unit = EXCLUDED.unit;
