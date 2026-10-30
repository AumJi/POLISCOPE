import { describe, expect, it, vi } from "vitest";
import {
  buildCurrentsSearchUrl,
  fetchCurrents,
  fetchCurrentsPages,
  normalizeCurrentsArticle,
} from "../server/news/currents.js";
import { getNewsProviderConfig } from "../server/news/provider.js";

describe("Currents v2 integration", () => {
  it("builds the Thai political search request using the v2 taxonomy", () => {
    const url = buildCurrentsSearchUrl({ pageSize: 10, cursor: "next-token" });

    expect(url.origin + url.pathname).toBe("https://api.currentsapi.services/v2/search");
    expect(url.searchParams.get("category")).toBe("politics_government");
    expect(url.searchParams.get("language")).toBe("th");
    expect(url.searchParams.get("country")).toBe("TH");
    expect(url.searchParams.get("page_size")).toBe("10");
    expect(url.searchParams.get("cursor")).toBe("next-token");
  });

  it("normalizes Currents fields and maps the provider category to the existing schema", () => {
    expect(normalizeCurrentsArticle({
      id: "currents-1",
      title: "ข่าวการเมืองไทย",
      description: "คำอธิบายจาก provider",
      content: "เนื้อหาที่มีจาก provider",
      url: "https://example.com/politics/1",
      image: "https://example.com/image.jpg",
      language: "th",
      category: ["politics_government"],
      published: "2026-10-30 10:00:00 +0000",
    })).toMatchObject({
      externalId: "currents-1",
      category: "politics",
      categories: ["politics"],
      originalUrl: "https://example.com/politics/1",
      content: "เนื้อหาที่มีจาก provider",
      source: { sourceKey: "example.com" },
    });
  });

  it("rejects unrelated categories and non-Thai responses", () => {
    expect(normalizeCurrentsArticle({ id: "1", title: "กีฬา", url: "https://example.com/1", language: "th", category: ["sport"] })).toBeNull();
    expect(normalizeCurrentsArticle({ id: "2", title: "English politics", url: "https://example.com/2", language: "en", category: ["politics_government"] })).toBeNull();
    expect(normalizeCurrentsArticle({ id: "3", title: "Unknown language", url: "https://example.com/3", category: ["politics_government"] })).toBeNull();
  });

  it("handles provider errors without exposing credentials", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "error", message: "quota" }), { status: 429 }));
    await expect(fetchCurrents({ apiKey: "secret-value", fetchImpl })).rejects.toMatchObject({ status: 429, code: "NEWS_RATE_LIMITED" });
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe("Bearer secret-value");
  });

  it("follows v2 cursor pagination up to the configured page limit", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ articles: [{ originalUrl: "https://example.com/1", externalId: "1", source: { sourceKey: "source" } }], nextPage: "cursor-2" })
      .mockResolvedValueOnce({ articles: [{ originalUrl: "https://example.com/2", externalId: "2", source: { sourceKey: "source" } }], nextPage: "cursor-3" })
      .mockResolvedValueOnce({ articles: [{ originalUrl: "https://example.com/3", externalId: "3", source: { sourceKey: "source" } }], nextPage: "cursor-4" });

    const result = await fetchCurrentsPages({ apiKey: "test-key", maxPages: 3, fetcher });

    expect(result.pagesFetched).toBe(3);
    expect(result.articles).toHaveLength(3);
    expect(fetcher.mock.calls.map(([options]) => options.cursor)).toEqual([undefined, "cursor-2", "cursor-3"]);
  });
});

describe("news provider selection", () => {
  it("defaults to Currents and reads its server-side key", () => {
    expect(getNewsProviderConfig({}).name).toBe("currents");
    expect(getNewsProviderConfig({ NEWS_PROVIDER: "currents", CURRENTS_API_KEY: "configured" })).toMatchObject({ configured: true, apiKey: "configured" });
  });

  it("keeps NewsData available only when explicitly selected", () => {
    expect(getNewsProviderConfig({ NEWS_PROVIDER: "newsdata", NEWS_API_KEY: "legacy" })).toMatchObject({ name: "newsdata", configured: true, apiKey: "legacy" });
  });
});
