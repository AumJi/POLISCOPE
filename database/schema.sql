-- POLISCOPE reference schema.
-- This file documents the expected Supabase PostgreSQL structure.
-- It is intentionally not executed by the application or deployment scripts.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS news_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key VARCHAR(120) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  website_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES news_sources(id),
  external_id VARCHAR(255),
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  original_url TEXT NOT NULL UNIQUE,
  image_url TEXT,
  category VARCHAR(100),
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  model_name VARCHAR(255) NOT NULL,
  input_hash CHAR(64) NOT NULL,
  summary_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS political_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_code VARCHAR(120) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  short_name VARCHAR(120),
  country_code CHAR(2) NOT NULL,
  official_website_url TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS article_parties (
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  party_id UUID NOT NULL REFERENCES political_parties(id) ON DELETE CASCADE,
  relation_type VARCHAR(120),
  tagging_method VARCHAR(120),
  is_reviewed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (article_id, party_id)
);

CREATE INDEX IF NOT EXISTS articles_published_at_idx ON articles (published_at DESC);
CREATE INDEX IF NOT EXISTS articles_source_id_idx ON articles (source_id);
CREATE INDEX IF NOT EXISTS articles_category_published_at_idx ON articles (category, published_at);
CREATE INDEX IF NOT EXISTS articles_source_published_at_idx ON articles (source_id, published_at);
CREATE INDEX IF NOT EXISTS article_parties_party_id_idx ON article_parties (party_id);
CREATE INDEX IF NOT EXISTS article_parties_party_reviewed_idx ON article_parties (party_id, is_reviewed);
CREATE INDEX IF NOT EXISTS ai_summaries_article_hash_idx ON ai_summaries (article_id, input_hash);
