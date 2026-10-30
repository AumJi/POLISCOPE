const CURRENTS_SEARCH_ENDPOINT = "https://api.currentsapi.services/v2/search";
export const CURRENTS_POLITICAL_CATEGORY = "politics_government";
export const POLISCOPE_POLITICAL_CATEGORY = "politics";
export const DEFAULT_MAX_INGESTION_PAGES = 3;
export const MAX_INGESTION_PAGES = 5;

export class CurrentsError extends Error {
  constructor(message, { status = 502, code = "NEWS_PROVIDER_ERROR" } = {}) {
    super(message);
    this.name = "CurrentsError";
    this.status = status;
    this.code = code;
  }
}

export function buildCurrentsSearchUrl({ pageSize = 10, cursor, category = CURRENTS_POLITICAL_CATEGORY, language = "th", country = "TH" } = {}) {
  const url = new URL(CURRENTS_SEARCH_ENDPOINT);
  const searchParams = new URLSearchParams({
    category,
    language,
    country,
    type: "1",
    page_size: String(Math.min(Math.max(pageSize, 1), 20)),
  });
  if (cursor) searchParams.set("cursor", cursor);
  url.search = searchParams.toString();
  return url;
}

function asText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeDate(value) {
  const text = asText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

export function normalizeCategories(value) {
  const values = Array.isArray(value) ? value : [value];
  return [...new Set(values
    .filter((category) => typeof category === "string")
    .flatMap((category) => category.split(","))
    .map((category) => category.trim().toLowerCase())
    .filter(Boolean))];
}

export function hasPoliticalCategory(value) {
  return normalizeCategories(value).includes(CURRENTS_POLITICAL_CATEGORY);
}

function normalizeSourceKey(raw, originalUrl) {
  const explicitSource = asText(raw.source_id) || asText(raw.source?.id) || asText(raw.domain);
  if (explicitSource) return explicitSource.toLowerCase();

  try {
    return new URL(originalUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "unknown-source";
  }
}

function sourceWebsite(originalUrl) {
  try {
    return new URL(originalUrl).origin;
  } catch {
    return null;
  }
}

export function normalizeCurrentsArticle(raw, { requiredCategory = CURRENTS_POLITICAL_CATEGORY, outputCategory = POLISCOPE_POLITICAL_CATEGORY, requiredLanguage = "th" } = {}) {
  if (!raw || typeof raw !== "object") return null;

  const originalUrl = asText(raw.url);
  const title = asText(raw.title);
  const categories = normalizeCategories(raw.category);
  const language = asText(raw.language || raw.lang)?.toLowerCase();

  // The query requests Thai. Reject a response that explicitly identifies itself
  // as another language so international articles cannot leak into the Thai feed.
  if (!originalUrl || !title || !categories.includes(requiredCategory) || language !== requiredLanguage) return null;

  const sourceKey = normalizeSourceKey(raw, originalUrl);
  const sourceName = asText(raw.source_name) || asText(raw.source?.name) || asText(raw.publisher) || sourceKey;
  const normalizedCategories = categories.map((category) => category === requiredCategory ? outputCategory : category);

  return {
    externalId: asText(raw.id),
    title,
    description: asText(raw.description),
    content: asText(raw.content),
    originalUrl,
    imageUrl: asText(raw.image) || asText(raw.image_url),
    category: normalizedCategories.join(","),
    categories: normalizedCategories,
    publishedAt: normalizeDate(raw.published || raw.pubDate),
    source: {
      sourceKey,
      name: sourceName,
      websiteUrl: asText(raw.source_url) || sourceWebsite(originalUrl),
    },
  };
}

export function deduplicateArticles(articles) {
  const seenUrls = new Set();
  const seenExternalIds = new Set();

  return articles.filter((article) => {
    const urlKey = article.originalUrl.toLowerCase();
    const externalKey = article.externalId ? `${article.source.sourceKey}:${article.externalId}` : null;
    if (seenUrls.has(urlKey) || (externalKey && seenExternalIds.has(externalKey))) return false;
    seenUrls.add(urlKey);
    if (externalKey) seenExternalIds.add(externalKey);
    return true;
  });
}

function providerError(response, payload) {
  if (response.status === 401) return new CurrentsError("Currents API key was rejected", { status: 401, code: "NEWS_PROVIDER_UNAUTHORIZED" });
  if (response.status === 403) return new CurrentsError("Currents API access is forbidden", { status: 403, code: "NEWS_PROVIDER_FORBIDDEN" });
  if (response.status === 429) return new CurrentsError("Currents API rate limit reached", { status: 429, code: "NEWS_RATE_LIMITED" });
  return new CurrentsError(asText(payload?.message) || "Currents could not return political news", { status: response.status >= 400 ? response.status : 502, code: "NEWS_PROVIDER_ERROR" });
}

export async function fetchCurrents({
  apiKey = process.env.CURRENTS_API_KEY,
  fetchImpl = fetch,
  pageSize = 10,
  cursor,
  category = CURRENTS_POLITICAL_CATEGORY,
  outputCategory = POLISCOPE_POLITICAL_CATEGORY,
  language = "th",
  country = "TH",
} = {}) {
  if (!apiKey) throw new CurrentsError("Currents API key is not configured", { status: 503, code: "NEWS_API_NOT_CONFIGURED" });

  let response;
  try {
    response = await fetchImpl(buildCurrentsSearchUrl({ pageSize, cursor, category, language, country }), {
      headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new CurrentsError("Unable to reach the Currents provider", { code: "NEWS_PROVIDER_UNREACHABLE" });
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new CurrentsError("Currents returned an invalid response");
  }

  if (!response.ok || payload?.status === "error") throw providerError(response, payload);

  const rawArticles = Array.isArray(payload?.news) ? payload.news : [];
  return {
    articles: deduplicateArticles(rawArticles.map((article) => normalizeCurrentsArticle(article, { requiredCategory: category, outputCategory, requiredLanguage: language })).filter(Boolean)).slice(0, pageSize),
    totalResults: rawArticles.length,
    nextPage: asText(payload?.next_cursor),
    cursor: cursor || null,
    fetchedAt: new Date().toISOString(),
  };
}

function normalizePageLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_INGESTION_PAGES;
  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_INGESTION_PAGES);
}

export async function fetchCurrentsPages({
  apiKey = process.env.CURRENTS_API_KEY,
  fetchImpl = fetch,
  pageSize = 10,
  maxPages = process.env.NEWS_MAX_PAGES || DEFAULT_MAX_INGESTION_PAGES,
  fetcher = fetchCurrents,
  category = CURRENTS_POLITICAL_CATEGORY,
  outputCategory = POLISCOPE_POLITICAL_CATEGORY,
  language = "th",
  country = "TH",
} = {}) {
  const pageLimit = normalizePageLimit(maxPages);
  const articles = [];
  let nextPage = null;
  let cursor;
  let pagesFetched = 0;

  for (let pageNumber = 0; pageNumber < pageLimit; pageNumber += 1) {
    const batch = await fetcher({ apiKey, fetchImpl, pageSize, cursor, category, outputCategory, language, country });
    pagesFetched += 1;
    articles.push(...batch.articles);
    nextPage = batch.nextPage || null;
    if (!nextPage) break;
    cursor = nextPage;
  }

  return {
    articles: deduplicateArticles(articles),
    totalResults: articles.length,
    pagesFetched,
    nextPage,
    fetchedAt: new Date().toISOString(),
  };
}

export { CURRENTS_SEARCH_ENDPOINT };
