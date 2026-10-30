-- MARKETSCOPE market data extension.
-- Review and run manually against the existing Supabase database.
-- This migration never drops or rewrites the POLISCOPE tables.

CREATE TABLE IF NOT EXISTS market_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  asset_class VARCHAR(32) NOT NULL CHECK (asset_class IN ('gold', 'oil', 'forex', 'stock', 'etf', 'mutual_fund')),
  currency_code CHAR(3) NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  quote_unit VARCHAR(64) NOT NULL,
  data_provider VARCHAR(64) NOT NULL,
  provider_symbol VARCHAR(64) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (data_provider, provider_symbol)
);

CREATE TABLE IF NOT EXISTS market_prices (
  asset_id UUID NOT NULL REFERENCES market_assets(id) ON DELETE CASCADE,
  price_date DATE NOT NULL,
  open_price NUMERIC(20, 8) CHECK (open_price IS NULL OR open_price > 0),
  high_price NUMERIC(20, 8) CHECK (high_price IS NULL OR high_price > 0),
  low_price NUMERIC(20, 8) CHECK (low_price IS NULL OR low_price > 0),
  close_price NUMERIC(20, 8) NOT NULL CHECK (close_price > 0),
  volume NUMERIC(24, 4) CHECK (volume IS NULL OR volume >= 0),
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (asset_id, price_date),
  CHECK (low_price IS NULL OR high_price IS NULL OR low_price <= high_price)
);

CREATE TABLE IF NOT EXISTS article_assets (
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES market_assets(id) ON DELETE CASCADE,
  relation_type VARCHAR(120) NOT NULL DEFAULT 'mentioned' CHECK (relation_type IN ('mentioned', 'main_subject', 'macro_context')),
  tagging_method VARCHAR(120) NOT NULL DEFAULT 'ai' CHECK (tagging_method IN ('manual', 'ai')),
  is_reviewed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (article_id, asset_id)
);

CREATE INDEX IF NOT EXISTS market_prices_asset_date_idx ON market_prices (asset_id, price_date DESC);
CREATE INDEX IF NOT EXISTS article_assets_asset_reviewed_idx ON article_assets (asset_id, is_reviewed);
CREATE INDEX IF NOT EXISTS article_assets_article_reviewed_idx ON article_assets (article_id, is_reviewed);

INSERT INTO market_assets (symbol, name, asset_class, currency_code, quote_unit, data_provider, provider_symbol)
VALUES
  ('XAUUSD', 'Gold / XAUUSD', 'gold', 'USD', 'USD per troy ounce', 'alphavantage', 'XAU'),
  ('WTI', 'West Texas Intermediate', 'oil', 'USD', 'USD per barrel', 'alphavantage', 'WTI'),
  ('USDTHB', 'US Dollar / Thai Baht', 'forex', 'THB', 'THB per USD', 'alphavantage', 'USD/THB'),
  ('AAPL', 'Apple Inc.', 'stock', 'USD', 'USD per share', 'alphavantage', 'AAPL'),
  ('MSFT', 'Microsoft Corporation', 'stock', 'USD', 'USD per share', 'alphavantage', 'MSFT'),
  ('VOO', 'Vanguard S&P 500 ETF', 'etf', 'USD', 'USD per share', 'alphavantage', 'VOO')
ON CONFLICT (symbol) DO UPDATE SET
  name = EXCLUDED.name,
  asset_class = EXCLUDED.asset_class,
  currency_code = EXCLUDED.currency_code,
  quote_unit = EXCLUDED.quote_unit,
  data_provider = EXCLUDED.data_provider,
  provider_symbol = EXCLUDED.provider_symbol,
  is_active = true;
