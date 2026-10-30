import { describe, expect, it, vi } from "vitest";
import { buildNewsDataUrl, deduplicateArticles, fetchNewsData, normalizeNewsArticle } from "../server/news/newsData.js";
import { NEWS_CACHE_TTL_MS, clearNewsCache, refreshNews } from "../server/news/service.js";

describe("NewsData integration", () => {
  it("builds the documented Thai politics request with a size limit", () => {
    const url = buildNewsDataUrl("test-key", { size: 10 });

    expect(url.origin + url.pathname).toBe("https://newsdata.io/api/1/latest");
    expect(url.searchParams.get("country")).toBe("th");
    expect(url.searchParams.get("language")).toBe("th");
    expect(url.searchParams.get("category")).toBe("politics");
    expect(url.searchParams.get("size")).toBe("10");
  });

  it("normalizes provider fields and discards incomplete records", () => {
    expect(normalizeNewsArticle({
      article_id: "provider-1",
      title: "  ข่าวการเมือง  ",
      link: "https://example.com/news/1",
      source_id: "example",
      source_name: "Example News",
      source_url: "https://example.com",
      description: "คำอธิบาย",
      content: "เนื้อหา",
      category: ["politics"],
      pubDate: "2026-10-30 10:00:00",
    })).toMatchObject({
      externalId: "provider-1",
      title: "ข่าวการเมือง",
      originalUrl: "https://example.com/news/1",
      source: { sourceKey: "example", name: "Example News" },
    });
    expect(normalizeNewsArticle({ title: "missing link" })).toBeNull();
  });

  it("deduplicates by URL and provider ID", () => {
    const first = normalizeNewsArticle({ article_id: "same", title: "A", link: "https://example.com/a", source_id: "source" });
    const duplicateUrl = normalizeNewsArticle({ article_id: "other", title: "B", link: "https://example.com/a", source_id: "source" });
    const duplicateId = normalizeNewsArticle({ article_id: "same", title: "C", link: "https://example.com/c", source_id: "source" });

    expect(deduplicateArticles([first, duplicateUrl, duplicateId])).toHaveLength(1);
  });

  it("fetches and normalizes a successful mocked response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: "success",
      totalResults: 1,
      results: [{ article_id: "1", title: "ข่าว", link: "https://example.com/1" }],
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await fetchNewsData({ apiKey: "test-key", fetchImpl });
    expect(result.articles).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("returns a typed error for rate limits", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "error" }), { status: 429 }));
    await expect(fetchNewsData({ apiKey: "test-key", fetchImpl })).rejects.toMatchObject({ status: 429, code: "NEWS_RATE_LIMITED" });
  });
});

describe("news refresh policy", () => {
  it("uses the successful in-memory result during the cache window", async () => {
    clearNewsCache();
    let clock = 1_000;
    const fetcher = vi.fn().mockResolvedValue({ articles: [], totalResults: 0, fetchedAt: "now" });
    const persister = vi.fn().mockResolvedValue(0);

    await refreshNews({ force: true, now: () => clock, fetcher, persister });
    clock += NEWS_CACHE_TTL_MS - 1;
    const cached = await refreshNews({ now: () => clock, fetcher, persister });

    expect(cached.cached).toBe(true);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
