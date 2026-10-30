import { describe, expect, it, vi } from "vitest";
import { buildAlphaVantageUrl, fetchAlphaVantageAsset, normalizeAlphaVantageObservations } from "../server/markets/alphaVantage.js";
import { calculateMarketAnalytics, calculateMovingAverage, calculateVolatility } from "../server/markets/analytics.js";
import { findMarketAsset } from "../server/markets/assets.js";

const apple = findMarketAsset("AAPL");

describe("Alpha Vantage market provider", () => {
  it("builds a daily request for a configured asset", () => {
    const url = buildAlphaVantageUrl(apple, "secret-key");
    expect(url.origin + url.pathname).toBe("https://www.alphavantage.co/query");
    expect(url.searchParams.get("function")).toBe("TIME_SERIES_DAILY");
    expect(url.searchParams.get("symbol")).toBe("AAPL");
    expect(url.searchParams.get("outputsize")).toBe("compact");
  });

  it("normalizes time-series observations and ignores invalid prices", () => {
    const rows = normalizeAlphaVantageObservations({
      "Time Series (Daily)": {
        "2026-10-30": { "1. open": "100", "2. high": "110", "3. low": "99", "4. close": "105", "5. volume": "1000" },
        "2026-10-29": { "4. close": "not-a-number" },
      },
    }, apple);
    expect(rows).toEqual([expect.objectContaining({ priceDate: "2026-10-30", close: 105, volume: 1000, source: "alpha_vantage" })]);
  });

  it("handles provider quota responses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ Note: "limit" }), { status: 200 }));
    await expect(fetchAlphaVantageAsset({ asset: apple, apiKey: "secret-key", fetchImpl })).rejects.toMatchObject({ status: 429, code: "MARKET_RATE_LIMITED" });
  });
});

describe("market analytics", () => {
  const observations = [
    { priceDate: "2026-10-01", close: 100 },
    { priceDate: "2026-10-02", close: 110 },
    { priceDate: "2026-10-03", close: 105 },
  ];

  it("calculates percentage change from the valid period endpoints", () => {
    expect(calculateMarketAnalytics(observations)).toMatchObject({ observationCount: 3, earliestClose: 100, latestClose: 105, percentageChange: 5 });
  });

  it("calculates observation-based moving averages and volatility", () => {
    expect(calculateMovingAverage(observations, 2).at(-1).value).toBe(107.5);
    expect(calculateVolatility(observations)).toBeGreaterThan(0);
    expect(calculateMarketAnalytics([{ priceDate: "2026-10-01", close: 100 }]).volatility).toBeNull();
  });
});
