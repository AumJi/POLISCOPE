import { isDatabaseConfigured } from "../db/pool.js";
import { persistNewsArticles } from "./persist.js";
import { fetchNewsDataPages } from "./newsData.js";
import { tagArticlesWithTyphoon } from "../parties/tagging.js";

export const NEWS_CACHE_TTL_MS = 15 * 60 * 1000;

let memoryCache = null;
let ingestionInProgress = false;

export function clearNewsCache() {
  memoryCache = null;
}

export function isNewsIngestionRunning() {
  return ingestionInProgress;
}

export async function refreshNews({
  force = false,
  now = () => Date.now(),
  fetcher = fetchNewsDataPages,
  persister = persistNewsArticles,
  partyTagger = tagArticlesWithTyphoon,
  tagParties = true,
  maxPages,
} = {}) {
  if (!force && memoryCache && now() - memoryCache.cachedAt < NEWS_CACHE_TTL_MS) {
    return { ...memoryCache.value, cached: true };
  }

  if (!process.env.NEWS_API_KEY && fetcher === fetchNewsDataPages) {
    return { refreshed: false, skipped: "NEWS_API_KEY is not configured", cached: false };
  }

  if (ingestionInProgress) {
    return { refreshed: false, skipped: "another ingestion is already running", cached: false, inProgress: true };
  }

  ingestionInProgress = true;
  try {
    const fetched = fetcher === fetchNewsDataPages ? await fetcher({ maxPages }) : await fetcher();
    const persisted = isDatabaseConfigured ? await persister(fetched.articles) : 0;
    const tagging = tagParties && isDatabaseConfigured && persisted?.articles?.length
      ? await partyTagger(persisted.articles)
      : null;
    const savedCount = typeof persisted === "number" ? persisted : persisted?.saved || 0;
    const value = {
      refreshed: true,
      savedCount,
      suggestedAssociations: typeof persisted === "number" ? 0 : (persisted?.suggestedAssociations || 0) + (tagging?.deterministic || 0) + (tagging?.aiSuggested || 0),
      partyTagging: tagging,
      articleCount: fetched.articles.length,
      pagesFetched: fetched.pagesFetched || 1,
      totalResults: fetched.totalResults,
      fetchedAt: fetched.fetchedAt,
    };

    memoryCache = { cachedAt: now(), value };
    return { ...value, cached: false };
  } finally {
    ingestionInProgress = false;
  }
}
