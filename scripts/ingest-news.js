import "dotenv/config";
import { isDatabaseConfigured } from "../server/db/pool.js";
import { refreshNews } from "../server/news/service.js";
import { getNewsProviderConfig } from "../server/news/provider.js";
import { closePool } from "../server/db/pool.js";

const provider = getNewsProviderConfig();
if (!isDatabaseConfigured || !provider.configured) {
  console.error(`News ingestion requires DATABASE_URL and ${provider.name === "currents" ? "CURRENTS_API_KEY" : "NEWS_API_KEY"} in the server environment.`);
  process.exitCode = 1;
} else {
  try {
    const result = await refreshNews({
      force: true,
      onProgress: (progress) => console.log(`[news] page ${progress.page || "feed"}: ${progress.articles} articles`),
    });
    if (result.skipped) {
      console.error(result.skipped);
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify({
        ok: true,
        articleCount: result.articleCount || 0,
        savedCount: result.savedCount || 0,
        pagesFetched: result.pagesFetched || 0,
        cached: Boolean(result.cached),
      }));
    }
  } catch (error) {
    console.error(`News ingestion failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
