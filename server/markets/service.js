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
  onProgress = () => {},
} = {}) {
  if (!isDatabaseConfigured) return { refreshed: false, skipped: "Database is not configured", savedCount: 0 };
  if (!apiKey && fetcher === fetchAlphaVantageAsset) return { refreshed: false, skipped: "ALPHA_VANTAGE_API_KEY is not configured", savedCount: 0 };
  if (ingestionInProgress) return { refreshed: false, skipped: "another market ingestion is already running", inProgress: true, savedCount: 0 };

  ingestionInProgress = true;
  const results = [];
  const errors = [];
  try {
    for (const asset of MARKET_ASSETS) {
      onProgress({ symbol: asset.symbol, status: "started" });
      try {
        results.push(await fetcher({ asset, apiKey }));
        onProgress({ symbol: asset.symbol, status: "succeeded" });
      } catch (error) {
        errors.push({ symbol: asset.symbol, code: error.code || "MARKET_PROVIDER_ERROR", message: error.message });
        onProgress({ symbol: asset.symbol, status: "failed", code: error.code || "MARKET_PROVIDER_ERROR" });
      }
    }
    const observationsFetched = results.reduce((total, result) => total + result.observations.length, 0);
    onProgress({ symbol: "database", status: "persisting", observations: observationsFetched });
    const savedCount = results.length ? await persister(results) : 0;
    onProgress({ symbol: "database", status: "succeeded", observations: savedCount });
    return { refreshed: true, assetsFetched: results.length, savedCount, errors, fetchedAt: new Date().toISOString() };
  } finally {
    ingestionInProgress = false;
  }
}
