import "dotenv/config";
import { ingestMarkets } from "../server/markets/service.js";

const result = await ingestMarkets();
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
}
