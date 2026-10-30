import "dotenv/config";
import { ingestMarkets } from "../server/markets/service.js";
import { closePool } from "../server/db/pool.js";

try {
  const result = await ingestMarkets({
    onProgress: (progress) => console.log(`[markets] ${progress.symbol}: ${progress.status}`),
  });
  if (result.skipped) {
    console.error(result.skipped);
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({
      ok: result.errors?.length === 0,
      assetsFetched: result.assetsFetched,
      savedCount: result.savedCount,
      errors: result.errors,
    }));
    process.exitCode = result.errors?.length ? 1 : 0;
  }
} catch (error) {
  console.error(`Market ingestion failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await closePool();
}
