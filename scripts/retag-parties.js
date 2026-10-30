import "dotenv/config";
import { isDatabaseConfigured, closePool } from "../server/db/pool.js";
import { listPoliticalArticlesForRetagging, tagArticlesWithTyphoon } from "../server/parties/tagging.js";

if (!isDatabaseConfigured) {
  console.error("Party retagging requires DATABASE_URL in the server environment.");
  process.exitCode = 1;
} else {
  try {
    const articles = await listPoliticalArticlesForRetagging();
    const result = await tagArticlesWithTyphoon(articles, { force: true });
    console.log(JSON.stringify({ ok: true, articleCount: articles.length, ...result }));
  } catch (error) {
    console.error(`Party retagging failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
