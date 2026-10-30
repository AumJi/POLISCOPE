import { describe, expect, it } from "vitest";
import { appendScopeFilters, parseAnalyticsRange } from "../server/analytics/repository.js";
import { buildTopicAnalysis, buildTopicFrequencies } from "../server/analytics/topics.js";

describe("analytics query rules", () => {
  it("accepts only the supported reporting ranges", () => {
    expect(parseAnalyticsRange("7d")).toEqual({ key: "7d", days: 7 });
    expect(parseAnalyticsRange("30d")).toEqual({ key: "30d", days: 30 });
    expect(() => parseAnalyticsRange("90d")).toThrow("range must be 7d or 30d");
  });

  it("builds parameterized party and source scope filters", () => {
    const filters = [];
    const values = [30];
    appendScopeFilters(filters, values, { partyCode: "DEMO", sourceKey: "source-a" });

    expect(values).toEqual([30, "DEMO", "source-a"]);
    expect(filters.join(" ")).toContain("scoped_party.party_code = $2");
    expect(filters.join(" ")).toContain("scoped_source.source_key = $3");
    expect(filters.join(" ")).not.toContain("'DEMO'");
  });
});

describe("keyword topic analysis", () => {
  const articles = [
    { id: "1", title: "budget reform", originalUrl: "https://example.com/1", publishedDate: "2026-10-30", sourceName: "Source A" },
    { id: "2", title: "budget reform update", originalUrl: "https://example.com/2", publishedDate: "2026-10-29", sourceName: "Source B" },
    { id: "3", title: "budget committee", originalUrl: "https://example.com/3", publishedDate: "2026-10-23", sourceName: "Source A" },
  ];

  it("counts distinct supporting articles and preserves source links", () => {
    const topics = buildTopicFrequencies(articles, { startDate: "2026-10-24", endDate: "2026-10-30" });
    const budget = topics.find((topic) => topic.keyword === "budget");

    expect(budget.articleCount).toBe(2);
    expect(budget.articles[0]).toMatchObject({ id: "1", originalUrl: "https://example.com/1" });
  });

  it("reports increases only when at least 14 days of coverage exist", () => {
    const available = buildTopicAnalysis(articles, { selectedDays: 7, analysisEndDate: "2026-10-30", coverage: { coverageSpanDays: 14 } });
    const insufficient = buildTopicAnalysis(articles, { selectedDays: 7, analysisEndDate: "2026-10-30", coverage: { coverageSpanDays: 13 } });

    expect(available.trendAvailable).toBe(true);
    expect(available.trends.find((trend) => trend.keyword === "budget")?.difference).toBe(1);
    expect(insufficient.trendAvailable).toBe(false);
    expect(insufficient.trends).toEqual([]);
  });
});
