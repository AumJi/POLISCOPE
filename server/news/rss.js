const DEFAULT_TIMEOUT_MS = 10_000;
const POLITICAL_RSS_CATEGORIES = new Set(["politics", "political", "politics_government", "การเมือง"]);
export const INVESTMENT_RSS_CATEGORIES = new Set(["business", "finance", "economy", "markets", "market", "investment", "stocks", "gold", "oil", "forex", "การเงิน", "เศรษฐกิจ", "ตลาดทุน", "หุ้น", "ทองคำ", "น้ำมัน"]);

export class RssError extends Error {
  constructor(message, { status = 502, code = "NEWS_PROVIDER_ERROR" } = {}) {
    super(message);
    this.name = "RssError";
    this.status = status;
    this.code = code;
  }
}

function asText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function decodeXml(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function cleanText(value) {
  return asText(decodeXml(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}

function extractTag(block, tagNames) {
  for (const tagName of tagNames) {
    const escapedTag = tagName.replace(":", "\\:");
    const match = block.match(new RegExp(`<${escapedTag}\\b[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, "i"));
    if (match?.[1]) return match[1];
  }
  return null;
}

function extractTags(block, tagName) {
  const escapedTag = tagName.replace(":", "\\:");
  return [...block.matchAll(new RegExp(`<${escapedTag}\\b[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, "gi"))]
    .map((match) => cleanText(match[1]))
    .filter(Boolean);
}

function normalizeDate(value) {
  const text = cleanText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function sourceFromUrl(url) {
  try {
    const parsed = new URL(url);
    return {
      sourceKey: parsed.hostname.replace(/^www\./, "").toLowerCase(),
      name: parsed.hostname.replace(/^www\./, ""),
      websiteUrl: parsed.origin,
    };
  } catch {
    return { sourceKey: "unknown-rss-source", name: "RSS source", websiteUrl: null };
  }
}

export function parseRssArticles(xml, feedUrl, { categories: allowedCategories = POLITICAL_RSS_CATEGORIES, outputCategory = "politics" } = {}) {
  const items = [...String(xml || "").matchAll(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi)].map((match) => match[1]);
  const feedSource = sourceFromUrl(feedUrl);

  return items.map((item) => {
    const originalUrl = cleanText(extractTag(item, ["link"])) || cleanText(extractTag(item, ["guid", "id"]));
    const title = cleanText(extractTag(item, ["title"]));
    const itemCategories = extractTags(item, "category").map((category) => category.toLowerCase());
    if (!originalUrl || !title || !itemCategories.some((category) => allowedCategories.has(category))) return null;

    return {
      externalId: cleanText(extractTag(item, ["guid", "id"])),
      title,
      description: cleanText(extractTag(item, ["description", "summary"])),
      content: cleanText(extractTag(item, ["content:encoded", "content"])),
      originalUrl,
      imageUrl: null,
      category: outputCategory,
      categories: [outputCategory],
      publishedAt: normalizeDate(extractTag(item, ["pubDate", "published", "updated"])),
      source: feedSource,
    };
  }).filter(Boolean);
}

export function parsePoliticalRss(xml, feedUrl) {
  return parseRssArticles(xml, feedUrl, { categories: POLITICAL_RSS_CATEGORIES, outputCategory: "politics" });
}

export function parseInvestmentRss(xml, feedUrl) {
  return parseRssArticles(xml, feedUrl, { categories: INVESTMENT_RSS_CATEGORIES, outputCategory: "investment" });
}

export function parseRssFeeds(value) {
  return String(value || "").split(",").map((feed) => feed.trim()).filter(Boolean);
}

export async function fetchRssPages({
  feeds = parseRssFeeds(process.env.RSS_FEEDS),
  fetchImpl = fetch,
  categories = POLITICAL_RSS_CATEGORIES,
  outputCategory = "politics",
  onProgress = () => {},
} = {}) {
  if (!feeds.length) throw new RssError("No RSS feeds are configured", { status: 503, code: "RSS_FEEDS_NOT_CONFIGURED" });

  const articles = [];
  const errors = [];
  for (const feedUrl of feeds) {
    let response;
    try {
      response = await fetchImpl(feedUrl, {
        headers: { Accept: "application/rss+xml, application/atom+xml, text/xml" },
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
      if (!response.ok) {
        errors.push({ feedUrl, status: response.status });
        continue;
      }
      const xml = await response.text();
      articles.push(...parseRssArticles(xml, feedUrl, { categories, outputCategory }));
    } catch {
      errors.push({ feedUrl, status: "unreachable" });
    }
    onProgress({ feedUrl, articles: articles.length, status: response?.ok ? "succeeded" : "failed" });
  }

  if (!articles.length && errors.length === feeds.length) throw new RssError("Configured RSS feeds were unavailable", { code: "RSS_PROVIDER_UNAVAILABLE" });
  return { articles, totalResults: articles.length, pagesFetched: 1, nextPage: null, errors, fetchedAt: new Date().toISOString() };
}
