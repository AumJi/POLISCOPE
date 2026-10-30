import { query } from "../db/query.js";

export const MARKET_ANALYTICS_RANGES = Object.freeze({ "7d": 7, "30d": 30, "90d": 90 });

export function parseMarketAnalyticsRange(value, fallback = "30d") {
  const selected = value || fallback;
  if (!Object.hasOwn(MARKET_ANALYTICS_RANGES, selected)) {
    const error = new Error("range must be 7d, 30d, or 90d");
    error.status = 400;
    error.code = "INVALID_MARKET_ANALYTICS_RANGE";
    throw error;
  }
  return { key: selected, days: MARKET_ANALYTICS_RANGES[selected] };
}

export async function getInvestmentAnalyticsOverview({ range = "30d" } = {}) {
  const { key, days } = parseMarketAnalyticsRange(range);
  const result = await query(`
    WITH bounds AS (
      SELECT ((NOW() AT TIME ZONE 'Asia/Bangkok')::date - ($1::int - 1)) AS start_date,
             (NOW() AT TIME ZONE 'Asia/Bangkok')::date AS end_date
    )
    SELECT
      (SELECT COUNT(*)::int FROM articles a WHERE LOWER(a.category) = 'investment') AS total_articles,
      (SELECT COUNT(*)::int FROM market_assets) AS total_assets,
      (SELECT COUNT(DISTINCT a.source_id)::int FROM articles a WHERE LOWER(a.category) = 'investment') AS total_sources,
      (SELECT COUNT(DISTINCT s.article_id)::int FROM ai_summaries s INNER JOIN articles a ON a.id = s.article_id WHERE LOWER(a.category) = 'investment') AS total_summarized_articles,
      (SELECT MIN(a.published_at) FROM articles a WHERE LOWER(a.category) = 'investment') AS earliest_article_date,
      (SELECT MAX(a.published_at) FROM articles a WHERE LOWER(a.category) = 'investment') AS latest_article_date,
      (SELECT MAX(a.fetched_at) FROM articles a WHERE LOWER(a.category) = 'investment') AS last_ingested_at,
      (SELECT COUNT(*)::int FROM articles a, bounds WHERE LOWER(a.category) = 'investment' AND a.published_at >= (bounds.start_date::timestamp AT TIME ZONE 'Asia/Bangkok') AND a.published_at < ((bounds.end_date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')) AS total_articles_in_range
  `, [days]);
  const row = result.rows[0] || {};
  return {
    totalArticles: row.total_articles || 0,
    totalAssets: row.total_assets || 0,
    totalSources: row.total_sources || 0,
    totalSummarizedArticles: row.total_summarized_articles || 0,
    earliestArticleDate: row.earliest_article_date,
    latestArticleDate: row.latest_article_date,
    lastIngestedAt: row.last_ingested_at,
    selectedRange: key,
    totalArticlesInRange: row.total_articles_in_range || 0,
  };
}

export async function getInvestmentNewsVolume({ range = "30d", assetSymbol, includeUnreviewed = false } = {}) {
  const { key, days } = parseMarketAnalyticsRange(range, "30d");
  const values = [days];
  const assetFilter = assetSymbol ? `AND EXISTS (SELECT 1 FROM article_assets aa_filter INNER JOIN market_assets ma_filter ON ma_filter.id = aa_filter.asset_id WHERE aa_filter.article_id = a.id ${includeUnreviewed ? "" : "AND aa_filter.is_reviewed = true"} AND ma_filter.symbol = $2)` : "";
  if (assetSymbol) values.push(assetSymbol);
  const result = await query(`
    WITH bounds AS (
      SELECT ((NOW() AT TIME ZONE 'Asia/Bangkok')::date - ($1::int - 1)) AS start_date,
             (NOW() AT TIME ZONE 'Asia/Bangkok')::date AS end_date
    ), days AS (
      SELECT generate_series(start_date, end_date, interval '1 day')::date AS day FROM bounds
    )
    SELECT TO_CHAR(days.day, 'YYYY-MM-DD') AS date, COUNT(DISTINCT a.id)::int AS article_count
    FROM days
    LEFT JOIN articles a ON LOWER(a.category) = 'investment'
      AND a.published_at >= (days.day::timestamp AT TIME ZONE 'Asia/Bangkok')
      AND a.published_at < ((days.day + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')
      ${assetFilter}
    GROUP BY days.day ORDER BY days.day ASC
  `, values);
  return { selectedRange: key, timeline: result.rows.map((row) => ({ date: row.date, articleCount: row.article_count || 0 })) };
}

export async function getInvestmentAssetCounts({ range = "30d", includeUnreviewed = false } = {}) {
  const { key, days } = parseMarketAnalyticsRange(range, "30d");
  const visibilitySql = includeUnreviewed ? "" : " AND aa.is_reviewed = true";
  const result = await query(`
    WITH bounds AS (
      SELECT ((NOW() AT TIME ZONE 'Asia/Bangkok')::date - ($1::int - 1)) AS start_date,
             (NOW() AT TIME ZONE 'Asia/Bangkok')::date AS end_date
    )
    SELECT ma.symbol, ma.name, ma.asset_class, COUNT(DISTINCT a.id)::int AS article_count
    FROM market_assets ma
    LEFT JOIN article_assets aa ON aa.asset_id = ma.id${visibilitySql}
    LEFT JOIN articles a ON a.id = aa.article_id AND LOWER(a.category) = 'investment'
      AND a.published_at >= ((SELECT start_date FROM bounds)::timestamp AT TIME ZONE 'Asia/Bangkok')
      AND a.published_at < (((SELECT end_date FROM bounds) + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')
    GROUP BY ma.id ORDER BY ma.name ASC
  `, [days]);
  return { selectedRange: key, includeUnreviewed, assets: result.rows.map((row) => ({ symbol: row.symbol, name: row.name, assetType: row.asset_class, category: row.asset_class, articleCount: row.article_count || 0 })) };
}

export async function getInvestmentTopicArticles({ days = 30 } = {}) {
  const result = await query(`
    SELECT a.id, a.title, a.original_url, a.published_at, source.name AS source_name
    FROM articles a
    INNER JOIN news_sources source ON source.id = a.source_id
    WHERE LOWER(a.category) = 'investment'
      AND a.published_at >= (NOW() - ($1::int * INTERVAL '1 day'))
    ORDER BY a.published_at DESC
    LIMIT 500
  `, [days]);
  return result.rows.map((row) => ({ id: row.id, title: row.title, originalUrl: row.original_url, publishedAt: row.published_at, sourceName: row.source_name }));
}
