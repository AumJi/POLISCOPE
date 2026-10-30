const NEWS_DATA_ENDPOINT = "https://newsdata.io/api/1/latest";

export class NewsDataError extends Error {
  constructor(message, { status = 502, code = "NEWS_PROVIDER_ERROR" } = {}) {
    super(message);
    this.name = "NewsDataError";
    this.status = status;
    this.code = code;
  }
}

export function buildNewsDataUrl(apiKey, { size = 10 } = {}) {
  const url = new URL(NEWS_DATA_ENDPOINT);
  url.search = new URLSearchParams({
    apikey: apiKey,
    country: "th",
    language: "th",
    category: "politics",
    size: String(Math.min(Math.max(size, 1), 10)),
    removeduplicate: "1",
  }).toString();
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

function normalizeSourceKey(raw, link) {
  const sourceId = asText(raw.source_id);
  if (sourceId) return sourceId.toLowerCase();

  try {
    return new URL(link).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "unknown-source";
  }
}

export function normalizeNewsArticle(raw) {
  if (!raw || typeof raw !== "object") return null;

  const originalUrl = asText(raw.link);
  const title = asText(raw.title);
  if (!originalUrl || !title) return null;

  const description = asText(raw.description) || asText(raw.content);
  const content = asText(raw.content) || description;
  const sourceKey = normalizeSourceKey(raw, originalUrl);

  let websiteUrl = asText(raw.source_url);
  if (!websiteUrl) {
    try {
      websiteUrl = new URL(originalUrl).origin;
    } catch {
      websiteUrl = null;
    }
  }

  return {
    externalId: asText(raw.article_id),
    title,
    description,
    content,
    originalUrl,
    imageUrl: asText(raw.image_url),
    category: Array.isArray(raw.category) ? asText(raw.category[0]) : asText(raw.category),
    publishedAt: normalizeDate(raw.pubDate),
    source: {
      sourceKey,
      name: asText(raw.source_name) || sourceKey,
      websiteUrl,
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

export async function fetchNewsData({
  apiKey = process.env.NEWS_API_KEY,
  fetchImpl = fetch,
  size = 10,
} = {}) {
  if (!apiKey) {
    throw new NewsDataError("NewsData API key is not configured", { status: 503, code: "NEWS_API_NOT_CONFIGURED" });
  }

  let response;
  try {
    response = await fetchImpl(buildNewsDataUrl(apiKey, { size }), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new NewsDataError("Unable to reach the NewsData provider", { code: "NEWS_PROVIDER_UNREACHABLE" });
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new NewsDataError("NewsData returned an invalid response");
  }

  if (!response.ok || payload?.status === "error") {
    const status = response.status === 429 ? 429 : response.ok ? 502 : response.status;
    throw new NewsDataError("NewsData could not return political news", {
      status,
      code: response.status === 429 ? "NEWS_RATE_LIMITED" : "NEWS_PROVIDER_ERROR",
    });
  }

  const rawArticles = Array.isArray(payload?.results) ? payload.results : [];
  return {
    articles: deduplicateArticles(rawArticles.map(normalizeNewsArticle).filter(Boolean)).slice(0, size),
    totalResults: Number(payload?.totalResults || 0),
    fetchedAt: new Date().toISOString(),
  };
}

export { NEWS_DATA_ENDPOINT };
