import { query } from "../db/query.js";
import { POLITICAL_ARTICLE_SQL } from "../db/repository.js";

export const ANALYTICS_RANGES = Object.freeze({ "7d": 7, "30d": 30 });

export function parseAnalyticsRange(value, fallback = "30d") {
  const selected = value || fallback;
  if (!Object.hasOwn(ANALYTICS_RANGES, selected)) {
    const error = new Error("range must be 7d or 30d");
    error.status = 400;
    error.code = "INVALID_ANALYTICS_RANGE";
    throw error;
  }
  return { key: selected, days: ANALYTICS_RANGES[selected] };
}

export function appendScopeFilters(filters, values, { partyCode, sourceKey } = {}) {
  if (partyCode) {
    values.push(partyCode);
    filters.push(`EXISTS (
      SELECT 1
      FROM article_parties scoped_ap
      INNER JOIN political_parties scoped_party ON scoped_party.id = scoped_ap.party_id
      WHERE scoped_ap.article_id = a.id
        AND scoped_ap.is_reviewed = true
        AND scoped_party.party_code = $${values.length}
    )`);
  }

  if (sourceKey) {
    values.push(sourceKey);
    filters.push(`EXISTS (
      SELECT 1
      FROM news_sources scoped_source
      WHERE scoped_source.id = a.source_id
        AND scoped_source.source_key = $${values.length}
    )`);
  }
}

function bangkokDateRangeSql() {
  return `
    a.published_at >= (bounds.start_date::timestamp AT TIME ZONE 'Asia/Bangkok')
    AND a.published_at < ((bounds.end_date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')
  `;
}

export async function getAnalyticsOverview({ range = "30d", partyCode, sourceKey } = {}) {
  const { key, days } = parseAnalyticsRange(range);
  const values = [days];
  const scopeFilters = [];
  appendScopeFilters(scopeFilters, values, { partyCode, sourceKey });
  const scopeSql = scopeFilters.length ? `AND ${scopeFilters.join(" AND ")}` : "";

  const result = await query(`
    WITH bounds AS (
      SELECT
        ((NOW() AT TIME ZONE 'Asia/Bangkok')::date - ($1::int - 1)) AS start_date,
        (NOW() AT TIME ZONE 'Asia/Bangkok')::date AS end_date
    )
    SELECT
      (SELECT COUNT(*)::int FROM articles a WHERE ${POLITICAL_ARTICLE_SQL} ${scopeSql}) AS total_articles,
      (SELECT COUNT(DISTINCT a.source_id)::int FROM articles a WHERE ${POLITICAL_ARTICLE_SQL} ${scopeSql}) AS total_sources,
      (SELECT COUNT(DISTINCT ap.party_id)::int
       FROM articles a
       INNER JOIN article_parties ap ON ap.article_id = a.id AND ap.is_reviewed = true
       WHERE ${POLITICAL_ARTICLE_SQL} ${scopeSql}) AS total_parties,
      (SELECT COUNT(DISTINCT summaries.article_id)::int
       FROM ai_summaries summaries
       INNER JOIN articles a ON a.id = summaries.article_id
       WHERE ${POLITICAL_ARTICLE_SQL} ${scopeSql}) AS total_summarized_articles,
      (SELECT MIN(a.published_at) FROM articles a WHERE ${POLITICAL_ARTICLE_SQL} ${scopeSql}) AS earliest_collected_article_date,
      (SELECT MAX(a.published_at) FROM articles a WHERE ${POLITICAL_ARTICLE_SQL} ${scopeSql}) AS latest_collected_article_date,
      (SELECT MAX(a.fetched_at) FROM articles a WHERE ${POLITICAL_ARTICLE_SQL} ${scopeSql}) AS last_ingested_at,
      (SELECT COUNT(*)::int
       FROM articles a, bounds
       WHERE ${POLITICAL_ARTICLE_SQL}
         AND ${bangkokDateRangeSql()} ${scopeSql}) AS total_articles_in_range
  `, values);

  const row = result.rows[0] || {};
  return {
    totalArticles: row.total_articles || 0,
    totalSources: row.total_sources || 0,
    totalParties: row.total_parties || 0,
    totalSummarizedArticles: row.total_summarized_articles || 0,
    earliestCollectedArticleDate: row.earliest_collected_article_date,
    latestCollectedArticleDate: row.latest_collected_article_date,
    lastIngestedAt: row.last_ingested_at,
    selectedRange: key,
    totalArticlesInRange: row.total_articles_in_range || 0,
  };
}

export async function getAnalyticsTimeline({ range = "30d", partyCode, sourceKey } = {}) {
  const { key, days } = parseAnalyticsRange(range);
  const values = [days];
  const scopeFilters = [];
  appendScopeFilters(scopeFilters, values, { partyCode, sourceKey });
  const scopeSql = scopeFilters.length ? `AND ${scopeFilters.join(" AND ")}` : "";
  const result = await query(`
    WITH bounds AS (
      SELECT
        ((NOW() AT TIME ZONE 'Asia/Bangkok')::date - ($1::int - 1)) AS start_date,
        (NOW() AT TIME ZONE 'Asia/Bangkok')::date AS end_date
    ), days AS (
      SELECT generate_series(start_date, end_date, interval '1 day')::date AS day
      FROM bounds
    )
    SELECT
      TO_CHAR(days.day, 'YYYY-MM-DD') AS date,
      COUNT(DISTINCT a.id)::int AS article_count
    FROM days
    LEFT JOIN articles a ON ${POLITICAL_ARTICLE_SQL}
      AND a.published_at >= (days.day::timestamp AT TIME ZONE 'Asia/Bangkok')
      AND a.published_at < ((days.day + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')
      ${scopeSql}
    GROUP BY days.day
    ORDER BY days.day ASC
  `, values);

  return {
    selectedRange: key,
    timeline: result.rows.map((row) => ({ date: row.date, articleCount: row.article_count || 0 })),
  };
}

export async function getAnalyticsParties({ range = "30d", partyCode, sourceKey } = {}) {
  const { key, days } = parseAnalyticsRange(range);
  const values = [days];
  const scopeFilters = [];
  appendScopeFilters(scopeFilters, values, { partyCode, sourceKey });
  const scopeSql = scopeFilters.length ? `AND ${scopeFilters.join(" AND ")}` : "";
  const result = await query(`
    WITH bounds AS (
      SELECT
        ((NOW() AT TIME ZONE 'Asia/Bangkok')::date - ($1::int - 1)) AS start_date,
        (NOW() AT TIME ZONE 'Asia/Bangkok')::date AS end_date
    )
    SELECT
      p.id,
      p.party_code,
      p.name,
      p.short_name,
      COUNT(DISTINCT a.id)::int AS article_count
    FROM bounds
    CROSS JOIN political_parties p
    LEFT JOIN article_parties ap ON ap.party_id = p.id AND ap.is_reviewed = true
    LEFT JOIN articles a ON a.id = ap.article_id
      AND ${POLITICAL_ARTICLE_SQL}
      AND ${bangkokDateRangeSql()}
      ${scopeSql}
    GROUP BY p.id
    ORDER BY p.name ASC, p.short_name ASC NULLS LAST
  `, values);

  return {
    selectedRange: key,
    parties: result.rows.map((row) => ({
      code: row.party_code,
      name: row.name,
      shortName: row.short_name,
      articleCount: row.article_count || 0,
    })),
  };
}

export async function getAnalyticsSources({ range = "30d", partyCode, sourceKey } = {}) {
  const { key, days } = parseAnalyticsRange(range);
  const values = [days];
  const scopeFilters = [];
  appendScopeFilters(scopeFilters, values, { partyCode, sourceKey });
  const scopeSql = scopeFilters.length ? `AND ${scopeFilters.join(" AND ")}` : "";
  const result = await query(`
    WITH bounds AS (
      SELECT
        ((NOW() AT TIME ZONE 'Asia/Bangkok')::date - ($1::int - 1)) AS start_date,
        (NOW() AT TIME ZONE 'Asia/Bangkok')::date AS end_date
    )
    SELECT
      source.id,
      source.source_key,
      source.name,
      COUNT(DISTINCT a.id)::int AS article_count
    FROM bounds
    CROSS JOIN news_sources source
    INNER JOIN articles a ON a.source_id = source.id
      AND ${POLITICAL_ARTICLE_SQL}
      AND ${bangkokDateRangeSql()}
      ${scopeSql}
    GROUP BY source.id
    ORDER BY source.name ASC
  `, values);

  return {
    selectedRange: key,
    sources: result.rows.map((row) => ({
      sourceKey: row.source_key,
      name: row.name,
      articleCount: row.article_count || 0,
    })),
  };
}

export async function getTopicSourceArticles({ days = 14, partyCode, sourceKey } = {}) {
  const values = [days];
  const scopeFilters = [];
  appendScopeFilters(scopeFilters, values, { partyCode, sourceKey });
  const scopeSql = scopeFilters.length ? `AND ${scopeFilters.join(" AND ")}` : "";
  const result = await query(`
    WITH bounds AS (
      SELECT
        ((NOW() AT TIME ZONE 'Asia/Bangkok')::date - ($1::int - 1)) AS start_date,
        (NOW() AT TIME ZONE 'Asia/Bangkok')::date AS end_date
    )
    SELECT
      bounds.end_date::text AS analysis_end_date,
      a.id,
      a.title,
      a.original_url,
      a.published_at,
      (a.published_at AT TIME ZONE 'Asia/Bangkok')::date::text AS published_date,
      source.name AS source_name
    FROM bounds
    LEFT JOIN articles a ON ${POLITICAL_ARTICLE_SQL}
      AND ${bangkokDateRangeSql()}
      ${scopeSql}
    LEFT JOIN news_sources source ON source.id = a.source_id
    WHERE a.id IS NOT NULL
    ORDER BY a.published_at DESC
  `, values);

  return {
    analysisEndDate: result.rows[0]?.analysis_end_date || null,
    articles: result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      originalUrl: row.original_url,
      publishedAt: row.published_at,
      publishedDate: row.published_date,
      sourceName: row.source_name,
    })),
  };
}

export async function getPoliticalCoverage({ partyCode, sourceKey } = {}) {
  const values = [];
  const scopeFilters = [];
  appendScopeFilters(scopeFilters, values, { partyCode, sourceKey });
  const scopeSql = scopeFilters.length ? `AND ${scopeFilters.join(" AND ")}` : "";
  const result = await query(`
    SELECT
      MIN((a.published_at AT TIME ZONE 'Asia/Bangkok')::date)::text AS earliest_date,
      MAX((a.published_at AT TIME ZONE 'Asia/Bangkok')::date)::text AS latest_date,
      COUNT(DISTINCT (a.published_at AT TIME ZONE 'Asia/Bangkok')::date)::int AS coverage_day_count
    FROM articles a
    WHERE ${POLITICAL_ARTICLE_SQL} ${scopeSql}
  `, values);
  const row = result.rows[0] || {};
  return {
    earliestDate: row.earliest_date || null,
    latestDate: row.latest_date || null,
    coverageDayCount: row.coverage_day_count || 0,
  };
}
