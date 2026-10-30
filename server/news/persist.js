import { withTransaction } from "../db/query.js";
import { findPartyMatches } from "../parties/matcher.js";

export async function persistNewsArticles(articles) {
  return withTransaction(async (client) => {
    let saved = 0;
    const savedArticles = [];

    const partiesResult = await client.query(`
      SELECT id, party_code, name, short_name
      FROM political_parties
      WHERE UPPER(country_code) = $1
      ORDER BY name ASC
    `, ["TH"]);
    const parties = partiesResult.rows;

    for (const article of articles) {
      const sourceResult = await client.query(`
        INSERT INTO news_sources (source_key, name, website_url)
        VALUES ($1, $2, $3)
        ON CONFLICT (source_key) DO UPDATE SET
          name = EXCLUDED.name,
          website_url = COALESCE(EXCLUDED.website_url, news_sources.website_url)
        RETURNING id
      `, [article.source.sourceKey, article.source.name, article.source.websiteUrl]);

      const sourceId = sourceResult.rows[0].id;
      const existingResult = await client.query(`
        SELECT id
        FROM articles
        WHERE original_url = $1
           OR (external_id IS NOT NULL AND external_id = $2 AND source_id = $3)
        LIMIT 1
      `, [article.originalUrl, article.externalId, sourceId]);

      let articleId;
      const isNew = !existingResult.rows[0];
      if (existingResult.rows[0]) {
        articleId = existingResult.rows[0].id;
        await client.query(`
          UPDATE articles
          SET external_id = $1,
              title = $2,
              description = $3,
              content = $4,
              original_url = $5,
              image_url = $6,
              category = $7,
              published_at = $8,
              fetched_at = NOW()
          WHERE id = $9
        `, [
          article.externalId,
          article.title,
          article.description,
          article.content,
          article.originalUrl,
          article.imageUrl,
          article.category,
          article.publishedAt,
          articleId,
        ]);
      } else {
        const insertedResult = await client.query(`
          INSERT INTO articles (
            source_id, external_id, title, description, content, original_url,
            image_url, category, published_at, fetched_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          RETURNING id
        `, [
          sourceId,
          article.externalId,
          article.title,
          article.description,
          article.content,
          article.originalUrl,
          article.imageUrl,
          article.category,
          article.publishedAt,
        ]);
        articleId = insertedResult.rows[0]?.id;
      }

      const matches = findPartyMatches(article, parties);
      savedArticles.push({ ...article, id: articleId, isNew, candidateMatches: matches });

      saved += 1;
    }

    return { saved, suggestedAssociations: 0, articles: savedArticles };
  });
}
