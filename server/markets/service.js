import { isDatabaseConfigured } from "../db/pool.js";
import { MARKET_ASSETS } from "./assets.js";
import { fetchAlphaVantageAsset } from "./alphaVantage.js";
import { persistMarketObservations } from "./repository.js";

let ingestionInProgress = false;

export function isMarketIngestionRunning() {
  return ingestionInProgress;
}

export async function ingestMarkets({
  apiKey = process.env.ALPHA_VANTAGE_API_KEY,
  fetcher = fetchAlphaVantageAsset,
  persister = persistMarketObservations,
} = {}) {
  if (!isDatabaseConfigured) return { refreshed: false, skipped: "Database is not configured", savedCount: 0 };
  if (!apiKey && fetcher === fetchAlphaVantageAsset) return { refreshed: false, skipped: "ALPHA_VANTAGE_API_KEY is not configured", savedCount: 0 };
  if (ingestionInProgress) return { refreshed: false, skipped: "another market ingestion is already running", inProgress: true, savedCount: 0 };

  ingestionInProgress = true;
  const results = [];
  const errors = [];
  try {
    for (const asset of MARKET_ASSETS) {
      try {
        results.push(await fetcher({ asset, apiKey }));
      } catch (error) {
        errors.push({ symbol: asset.symbol, code: error.code || "MARKET_PROVIDER_ERROR", message: error.message });
      }
    }
    const savedCount = results.length ? await persister(results) : 0;
    return { refreshed: true, assetsFetched: results.length, savedCount, errors, fetchedAt: new Date().toISOString() };
  } finally {
    ingestionInProgress = false;
  }
}
