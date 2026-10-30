import { isDatabaseConfigured } from "../db/pool.js";
import { persistNewsArticles } from "./persist.js";
import { fetchNewsData } from "./newsData.js";

export const NEWS_CACHE_TTL_MS = 15 * 60 * 1000;

let memoryCache = null;

export function clearNewsCache() {
  memoryCache = null;
}

export async function refreshNews({
  force = false,
  now = () => Date.now(),
  fetcher = fetchNewsData,
  persister = persistNewsArticles,
} = {}) {
  if (!force && memoryCache && now() - memoryCache.cachedAt < NEWS_CACHE_TTL_MS) {
    return { ...memoryCache.value, cached: true };
  }

  if (!process.env.NEWS_API_KEY && fetcher === fetchNewsData) {
    return { refreshed: false, skipped: "NEWS_API_KEY is not configured", cached: false };
  }

  const fetched = await fetcher();
  const savedCount = isDatabaseConfigured ? await persister(fetched.articles) : 0;
  const value = {
    refreshed: true,
    savedCount,
    articleCount: fetched.articles.length,
    totalResults: fetched.totalResults,
    fetchedAt: fetched.fetchedAt,
  };

  memoryCache = { cachedAt: now(), value };
  return { ...value, cached: false };
}
