-- Non-destructive analytics indexes.
-- Review existing indexes before applying this migration to the Supabase database.
-- The application never executes migrations automatically.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename = 'articles'
      AND indexdef ILIKE '%(category, published_at)%'
  ) THEN
    CREATE INDEX articles_category_published_at_idx ON articles (category, published_at);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename = 'articles'
      AND indexdef ILIKE '%(source_id, published_at)%'
  ) THEN
    CREATE INDEX articles_source_published_at_idx ON articles (source_id, published_at);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename = 'article_parties'
      AND indexdef ILIKE '%(party_id, is_reviewed)%'
  ) THEN
    CREATE INDEX article_parties_party_reviewed_idx ON article_parties (party_id, is_reviewed);
  END IF;
END $$;
