import { query, withTransaction } from "../db/query.js";
import { createTyphoonClient, DEFAULT_TYPHOON_MODEL } from "../ai/summarize.js";
import { buildPartyAssociationQuery } from "./matcher.js";
import { extractPartySuggestions } from "../ai/partyExtraction.js";

const POLITICAL_ARTICLE_FILTER = `(
  LOWER(a.category) = 'politics'
  OR (',' || LOWER(a.category) || ',') LIKE '%,politics,%'
)`;

export async function loadPartyCandidates() {
  const result = await query(`
    SELECT id, party_code, name, short_name
    FROM political_parties
    WHERE UPPER(country_code) = $1
    ORDER BY name ASC
  `, ["TH"]);
  return result.rows;
}

export async function listPoliticalArticlesForRetagging() {
  const result = await query(`
    SELECT a.id, a.title, a.description, a.content, a.published_at
    FROM articles a
    WHERE ${POLITICAL_ARTICLE_FILTER}
    ORDER BY a.published_at DESC NULLS LAST, a.fetched_at DESC
  `);
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    content: row.content,
    publishedAt: row.published_at,
  }));
}

async function getAssociationState(articleIds) {
  if (!articleIds.length) return new Map();
  const result = await query(`
    SELECT article_id, COUNT(*)::int AS association_count,
           BOOL_OR(is_reviewed) AS has_reviewed
    FROM article_parties
    WHERE article_id = ANY($1::uuid[])
    GROUP BY article_id
  `, [articleIds]);
  return new Map(result.rows.map((row) => [row.article_id, {
    associationCount: row.association_count,
    hasReviewed: row.has_reviewed,
  }]));
}

export async function persistPartyAssociations(associations) {
  if (!associations.length) return 0;
  return withTransaction(async (client) => {
    let saved = 0;
    for (const association of associations) {
      const associationQuery = buildPartyAssociationQuery({
        articleId: association.articleId,
        partyId: association.partyId,
        relationType: association.relationType,
        taggingMethod: association.taggingMethod,
      });
      const result = await client.query(associationQuery.text, associationQuery.values);
      saved += result.rowCount;
    }
    return saved;
  });
}

export async function tagArticlesWithTyphoon(articles, {
  force = false,
  client,
  model = process.env.TYPHOON_MODEL || DEFAULT_TYPHOON_MODEL,
} = {}) {
  const candidates = await loadPartyCandidates();
  if (!candidates.length) return { processed: 0, deterministic: 0, aiRequested: 0, aiSuggested: 0, skipped: articles.length, errors: 0 };

  const state = await getAssociationState(articles.map((article) => article.id).filter(Boolean));
  const result = { processed: 0, deterministic: 0, aiRequested: 0, aiSuggested: 0, skipped: 0, errors: 0 };
  let typhoonClient = client;

  for (const article of articles) {
    if (!force && article.isNew !== true) {
      result.skipped += 1;
      continue;
    }

    if (state.has(article.id)) {
      result.skipped += 1;
      continue;
    }

    result.processed += 1;
    if (!process.env.TYPHOON_API_KEY && !typhoonClient) continue;
    try {
      typhoonClient ||= createTyphoonClient();
      result.aiRequested += 1;
      const suggestions = await extractPartySuggestions({
        client: typhoonClient,
        model,
        article,
        parties: candidates,
        candidatePartyCodes: (article.candidateMatches || []).map((match) => match.partyCode),
      });
      if (suggestions.length) {
        const saved = await persistPartyAssociations(suggestions.map((suggestion) => ({
          articleId: article.id,
          partyId: suggestion.partyId,
          relationType: suggestion.relationType,
          taggingMethod: "ai",
        })));
        result.aiSuggested += saved;
      }
    } catch (error) {
      result.errors += 1;
      console.warn("Party extraction skipped", { articleId: article.id, code: error.code || "TYPHOON_ERROR" });
    }
  }

  return result;
}
