import { describe, expect, it } from "vitest";
import { calculateMockMarketAnalytics, getMockMarketData } from "../src/mockMarketData.js";

describe("local market demo data", () => {
  it("generates deterministic observations and calculated analytics", () => {
    const first = getMockMarketData("AAPL", "30d");
    const second = getMockMarketData("AAPL", "30d");

    expect(first.observations).toHaveLength(30);
    expect(first.observations.map((row) => row.close)).toEqual(second.observations.map((row) => row.close));
    expect(first.analytics).toMatchObject({ isMock: true, observationCount: 30, available: true });
    expect(first.analytics.sma7).toEqual(expect.any(Number));
    expect(first.analytics.sma30).toEqual(expect.any(Number));
  });

  it("uses the same deterministic formulas for a short range", () => {
    const data = getMockMarketData("WTI", "7d");
    expect(data.analytics).toEqual(calculateMockMarketAnalytics(data.observations));
    expect(data.analytics.volatility).toEqual(expect.any(Number));
  });
});
