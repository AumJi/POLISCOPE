import { query } from "./query.js";

export const INVESTMENT_ARTICLE_SQL = `(
  LOWER(a.category) = 'investment'
  OR (',' || LOWER(a.category) || ',') LIKE '%,investment,%'
)`;

function associationVisibilitySql(includeUnreviewed) {
  return includeUnreviewed ? "" : " AND aa.is_reviewed = true";
}

export function buildInvestmentNewsQuery({ assetSymbol, sourceKey, limit = 20, includeUnreviewed = false } = {}) {
  const values = [];
  const filters = [INVESTMENT_ARTICLE_SQL];
  const visibilitySql = associationVisibilitySql(includeUnreviewed);

  if (assetSymbol) {
    values.push(assetSymbol);
    filters.push(`EXISTS (
      SELECT 1 FROM article_assets filter_aa
      INNER JOIN market_assets filter_asset ON filter_asset.id = filter_aa.asset_id
      WHERE filter_aa.article_id = a.id
        ${includeUnreviewed ? "" : "AND filter_aa.is_reviewed = true"}
        AND filter_asset.symbol = $${values.length}
    )`);
  }

  if (sourceKey) {
    values.push(sourceKey);
    filters.push(`EXISTS (
      SELECT 1 FROM news_sources filter_source
      WHERE filter_source.id = a.source_id AND filter_source.source_key = $${values.length}
    )`);
  }

  values.push(Math.min(Math.max(Number(limit) || 20, 1), 50));
  return {
    text: `
      SELECT
        a.id, a.external_id, a.title, a.description, a.content, a.original_url,
        a.image_url, a.category, a.published_at, a.fetched_at,
        json_build_object('id', source.id, 'sourceKey', source.source_key, 'name', source.name, 'websiteUrl', source.website_url) AS source,
        COALESCE(json_agg(DISTINCT jsonb_build_object(
          'symbol', asset.symbol,
          'name', asset.name,
          'assetType', asset.asset_type,
          'category', asset.category,
          'relationType', aa.relation_type,
          'taggingMethod', aa.tagging_method,
          'isReviewed', aa.is_reviewed
        )) FILTER (WHERE asset.id IS NOT NULL${visibilitySql}), '[]'::json) AS assets
      FROM articles a
      INNER JOIN news_sources source ON source.id = a.source_id
      LEFT JOIN article_assets aa ON aa.article_id = a.id${visibilitySql}
      LEFT JOIN market_assets asset ON asset.id = aa.asset_id
      WHERE ${filters.join(" AND ")}
      GROUP BY a.id, source.id
      ORDER BY a.published_at DESC NULLS LAST, a.fetched_at DESC
      LIMIT $${values.length}
    `,
    values,
  };
}

function mapInvestmentArticleRow(row) {
  return {
    id: row.id,
    externalId: row.external_id,
    title: row.title,
    description: row.description,
    content: row.content,
    originalUrl: row.original_url,
    imageUrl: row.image_url,
    category: row.category,
    publishedAt: row.published_at,
    fetchedAt: row.fetched_at,
    source: row.source,
    assets: Array.isArray(row.assets) ? row.assets : [],
    parties: [],
  };
}

export async function listInvestmentNews(options = {}) {
  const { text, values } = buildInvestmentNewsQuery(options);
  const result = await query(text, values);
  return result.rows.map(mapInvestmentArticleRow);
}

export function buildInvestmentNewsCountQuery({ assetSymbol, sourceKey, includeUnreviewed = false } = {}) {
  const values = [];
  const filters = [INVESTMENT_ARTICLE_SQL];
  if (assetSymbol) {
    values.push(assetSymbol);
    filters.push(`EXISTS (SELECT 1 FROM article_assets filter_aa INNER JOIN market_assets filter_asset ON filter_asset.id = filter_aa.asset_id WHERE filter_aa.article_id = a.id ${includeUnreviewed ? "" : "AND filter_aa.is_reviewed = true"} AND filter_asset.symbol = $${values.length})`);
  }
  if (sourceKey) {
    values.push(sourceKey);
    filters.push(`EXISTS (SELECT 1 FROM news_sources filter_source WHERE filter_source.id = a.source_id AND filter_source.source_key = $${values.length})`);
  }
  return { text: `SELECT COUNT(*)::int AS total FROM articles a WHERE ${filters.join(" AND ")}`, values };
}

export async function countInvestmentNews(options = {}) {
  const { text, values } = buildInvestmentNewsCountQuery(options);
  const result = await query(text, values);
  return result.rows[0]?.total || 0;
}

export async function findInvestmentArticleById(articleId, { includeUnreviewed = false } = {}) {
  const visibilitySql = associationVisibilitySql(includeUnreviewed);
  const result = await query(`
    SELECT
      a.id, a.external_id, a.title, a.description, a.content, a.original_url,
      a.image_url, a.category, a.published_at, a.fetched_at,
      json_build_object('id', source.id, 'sourceKey', source.source_key, 'name', source.name, 'websiteUrl', source.website_url) AS source,
      COALESCE(json_agg(DISTINCT jsonb_build_object(
        'symbol', asset.symbol, 'name', asset.name, 'assetType', asset.asset_type,
        'category', asset.category, 'relationType', aa.relation_type,
        'taggingMethod', aa.tagging_method, 'isReviewed', aa.is_reviewed
      )) FILTER (WHERE asset.id IS NOT NULL${visibilitySql}), '[]'::json) AS assets
    FROM articles a
    INNER JOIN news_sources source ON source.id = a.source_id
    LEFT JOIN article_assets aa ON aa.article_id = a.id${visibilitySql}
    LEFT JOIN market_assets asset ON asset.id = aa.asset_id
    WHERE a.id = $1 AND ${INVESTMENT_ARTICLE_SQL}
    GROUP BY a.id, source.id
    LIMIT 1
  `, [articleId]);
  if (!result.rows[0]) return null;
  return mapInvestmentArticleRow(result.rows[0]);
}
