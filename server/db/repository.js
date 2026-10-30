import { query } from "./query.js";

export const POLITICAL_ARTICLE_SQL = `(
  LOWER(a.category) = 'politics'
  OR (',' || LOWER(a.category) || ',') LIKE '%,politics,%'
)`;

function associationVisibilitySql(includeUnreviewed) {
  return includeUnreviewed ? "" : " AND ap.is_reviewed = true";
}

export function buildNewsQuery({ partyCode, sourceKey, limit = 10, includeUnreviewed = false } = {}) {
  const values = [];
  const filters = [POLITICAL_ARTICLE_SQL];
  const visibilitySql = associationVisibilitySql(includeUnreviewed);

  if (partyCode) {
    values.push(partyCode);
    filters.push(`EXISTS (
      SELECT 1
      FROM article_parties filter_ap
      INNER JOIN political_parties filter_party ON filter_party.id = filter_ap.party_id
      WHERE filter_ap.article_id = a.id
        ${includeUnreviewed ? "" : "AND filter_ap.is_reviewed = true"}
        AND filter_party.party_code = $${values.length}
    )`);
  }

  if (sourceKey) {
    values.push(sourceKey);
    filters.push(`EXISTS (
      SELECT 1
      FROM news_sources filter_source
      WHERE filter_source.id = a.source_id
        AND filter_source.source_key = $${values.length}
    )`);
  }

  values.push(limit);

  return {
    text: `
      SELECT
        a.id,
        a.external_id,
        a.title,
        a.description,
        a.content,
        a.original_url,
        a.image_url,
        a.category,
        a.published_at,
        a.fetched_at,
        json_build_object(
          'id', source.id,
          'sourceKey', source.source_key,
          'name', source.name,
          'websiteUrl', source.website_url
        ) AS source,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'code', party.party_code,
              'name', party.name,
              'shortName', party.short_name,
              'countryCode', party.country_code,
              'officialWebsiteUrl', party.official_website_url,
              'logoUrl', party.logo_url,
              'relationType', ap.relation_type,
              'taggingMethod', ap.tagging_method,
              'isReviewed', ap.is_reviewed
            )
          ) FILTER (WHERE party.id IS NOT NULL${visibilitySql}),
          '[]'::json
        ) AS parties
      FROM articles a
      INNER JOIN news_sources source ON source.id = a.source_id
      LEFT JOIN article_parties ap ON ap.article_id = a.id${visibilitySql}
      LEFT JOIN political_parties party ON party.id = ap.party_id
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      GROUP BY a.id, source.id
      ORDER BY a.published_at DESC NULLS LAST, a.fetched_at DESC
      LIMIT $${values.length}
    `,
    values,
  };
}

export function mapArticleRow(row) {
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
    parties: Array.isArray(row.parties) ? row.parties : [],
  };
}

export async function listNews(options = {}) {
  const { text, values } = buildNewsQuery(options);
  const result = await query(text, values);
  return result.rows.map(mapArticleRow);
}

export function buildNewsCountQuery({ partyCode, sourceKey, includeUnreviewed = false } = {}) {
  const values = [];
  const filters = [POLITICAL_ARTICLE_SQL];

  if (partyCode) {
    values.push(partyCode);
    filters.push(`EXISTS (
      SELECT 1
      FROM article_parties filter_ap
      INNER JOIN political_parties filter_party ON filter_party.id = filter_ap.party_id
      WHERE filter_ap.article_id = a.id
        ${includeUnreviewed ? "" : "AND filter_ap.is_reviewed = true"}
        AND filter_party.party_code = $${values.length}
    )`);
  }

  if (sourceKey) {
    values.push(sourceKey);
    filters.push(`EXISTS (
      SELECT 1
      FROM news_sources filter_source
      WHERE filter_source.id = a.source_id
        AND filter_source.source_key = $${values.length}
    )`);
  }

  return {
    text: `
      SELECT COUNT(*)::int AS total
      FROM articles a
      WHERE ${filters.join(" AND ")}
    `,
    values,
  };
}

export async function countNews(options = {}) {
  const { text, values } = buildNewsCountQuery(options);
  const result = await query(text, values);
  return result.rows[0]?.total || 0;
}

export function buildPartiesQuery() {
  return {
    text: `
      SELECT
        p.id,
        p.party_code,
        p.name,
        p.short_name,
        p.country_code,
        p.official_website_url,
        p.logo_url,
        COUNT(DISTINCT a.id)::int AS article_count
      FROM political_parties p
      LEFT JOIN article_parties ap ON ap.party_id = p.id AND ap.is_reviewed = true
      LEFT JOIN articles a ON a.id = ap.article_id AND ${POLITICAL_ARTICLE_SQL}
      GROUP BY p.id
      ORDER BY p.name ASC
    `,
    values: [],
  };
}

export async function listParties() {
  const { text, values } = buildPartiesQuery();
  const result = await query(text, values);

  return result.rows.map(mapPartyRow);
}

export function mapPartyRow(row) {
  return {
    id: row.id,
    code: row.party_code,
    name: row.name,
    shortName: row.short_name,
    countryCode: row.country_code,
    officialWebsiteUrl: row.official_website_url,
    logoUrl: row.logo_url,
    articleCount: row.article_count || 0,
  };
}

export async function findArticleById(articleId, { includeUnreviewed = false } = {}) {
  const visibilitySql = associationVisibilitySql(includeUnreviewed);
  const result = await query(`
    SELECT
      a.id,
      a.external_id,
      a.title,
      a.description,
      a.content,
      a.original_url,
      a.image_url,
      a.category,
      a.published_at,
      a.fetched_at,
      json_build_object('id', source.id, 'sourceKey', source.source_key, 'name', source.name, 'websiteUrl', source.website_url) AS source,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'code', party.party_code,
            'name', party.name,
            'shortName', party.short_name,
            'countryCode', party.country_code,
            'officialWebsiteUrl', party.official_website_url,
            'logoUrl', party.logo_url,
            'relationType', ap.relation_type,
            'taggingMethod', ap.tagging_method,
            'isReviewed', ap.is_reviewed
          )
        ) FILTER (WHERE party.id IS NOT NULL${visibilitySql}),
        '[]'::json
      ) AS parties
    FROM articles a
    INNER JOIN news_sources source ON source.id = a.source_id
    LEFT JOIN article_parties ap ON ap.article_id = a.id${visibilitySql}
    LEFT JOIN political_parties party ON party.id = ap.party_id
    WHERE a.id = $1 AND ${POLITICAL_ARTICLE_SQL}
    GROUP BY a.id, source.id
    LIMIT 1
  `, [articleId]);

  return result.rows[0] ? mapArticleRow(result.rows[0]) : null;
}
