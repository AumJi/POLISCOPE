import { describe, expect, it, vi } from "vitest";
import {
  buildNewsDataUrl,
  deduplicateArticles,
  fetchNewsData,
  normalizeCategories,
  normalizeNewsArticle,
} from "../server/news/newsData.js";
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

  it("normalizes provider fields and only accepts political categories", () => {
    expect(normalizeNewsArticle({
      article_id: "provider-1",
      title: "political news",
      link: "https://example.com/news/1",
      source_id: "example",
      source_name: "Example News",
      source_url: "https://example.com",
      description: "provider excerpt",
      content: "provider content",
      category: ["Politics"],
      pubDate: "2026-10-30 10:00:00",
    })).toMatchObject({
      externalId: "provider-1",
      title: "political news",
      originalUrl: "https://example.com/news/1",
      category: "politics",
      categories: ["politics"],
      description: "provider excerpt",
      content: "provider content",
      source: { sourceKey: "example", name: "Example News" },
    });
    expect(normalizeCategories(["Politics", "top"])).toEqual(["politics", "top"]);
    expect(normalizeNewsArticle({ title: "sports", link: "https://example.com/sports", category: ["sports"] })).toBeNull();
    expect(normalizeNewsArticle({ title: "politics and sports", link: "https://example.com/mixed", category: ["sports", "politics"] })).toMatchObject({ category: "sports,politics" });
    expect(normalizeNewsArticle({ title: "missing link" })).toBeNull();
  });

  it("deduplicates by URL and provider ID", () => {
    const first = normalizeNewsArticle({ article_id: "same", title: "A", link: "https://example.com/a", source_id: "source", category: "politics" });
    const duplicateUrl = normalizeNewsArticle({ article_id: "other", title: "B", link: "https://example.com/a", source_id: "source", category: "politics" });
    const duplicateId = normalizeNewsArticle({ article_id: "same", title: "C", link: "https://example.com/c", source_id: "source", category: "politics" });

    expect(deduplicateArticles([first, duplicateUrl, duplicateId])).toHaveLength(1);
  });

  it("fetches only political articles from a mocked response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: "success",
      totalResults: 4,
      results: [
        { article_id: "1", title: "political", link: "https://example.com/1", category: ["politics"] },
        { article_id: "2", title: "sports", link: "https://example.com/2", category: ["sports"] },
        { article_id: "3", title: "mixed", link: "https://example.com/3", category: ["politics", "technology"] },
        { article_id: "4", title: "missing category", link: "https://example.com/4" },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await fetchNewsData({ apiKey: "test-key", fetchImpl });
    expect(result.articles).toHaveLength(2);
    expect(result.articles.every((article) => article.categories.includes("politics"))).toBe(true);
    expect(result.articles.some((article) => article.title === "sports")).toBe(false);
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
