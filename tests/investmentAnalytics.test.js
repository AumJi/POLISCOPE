import { describe, expect, it } from "vitest";
import { buildInvestmentTopicAnalysis, tokenizeInvestmentText } from "../server/analytics/investmentTopics.js";
import { parseMarketAnalyticsRange } from "../server/analytics/marketRepository.js";

describe("investment analytics helpers", () => {
  it("validates supported market reporting ranges", () => {
    expect(parseMarketAnalyticsRange("90d")).toEqual({ key: "90d", days: 90 });
    expect(() => parseMarketAnalyticsRange("365d")).toThrow();
  });

  it("removes generic terms and counts recurring headline terms", () => {
    expect(tokenizeInvestmentText("ตลาดทองคำ ราคาทองคำปรับขึ้น")).not.toContain("ตลาด");
    const topics = buildInvestmentTopicAnalysis([
      { id: "1", title: "ราคาทองคำปรับขึ้น", originalUrl: "https://one", publishedAt: null, sourceName: "One" },
      { id: "2", title: "ทองคำยังปรับขึ้นต่อ", originalUrl: "https://two", publishedAt: null, sourceName: "Two" },
    ]);
    expect(topics.find((topic) => topic.keyword === "ทองคำ")).toMatchObject({ articleCount: 2 });
  });
});
