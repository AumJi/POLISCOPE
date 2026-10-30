import "dotenv/config";
import { isDatabaseConfigured } from "../server/db/pool.js";
import { refreshNews } from "../server/news/service.js";

if (!isDatabaseConfigured || !process.env.NEWS_API_KEY) {
  console.error("News ingestion requires DATABASE_URL and NEWS_API_KEY in the server environment.");
  process.exitCode = 1;
} else {
  try {
    const result = await refreshNews({ force: true });
    console.log(JSON.stringify({
      ok: true,
      articleCount: result.articleCount || 0,
      savedCount: result.savedCount || 0,
      pagesFetched: result.pagesFetched || 0,
      cached: Boolean(result.cached),
    }));
  } catch (error) {
    console.error(`News ingestion failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}
