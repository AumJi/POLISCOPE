import { fetchCurrentsPages } from "./currents.js";
import { fetchNewsDataPages } from "./newsData.js";
import { fetchRssPages, parseRssFeeds, INVESTMENT_RSS_CATEGORIES } from "./rss.js";

export function getNewsProviderConfig(env = process.env) {
  const name = String(env.NEWS_PROVIDER || "currents").trim().toLowerCase();

  if (name === "newsdata") {
    return {
      name,
      apiKey: env.NEWS_API_KEY,
      configured: Boolean(env.NEWS_API_KEY),
      fetchPages: fetchNewsDataPages,
    };
  }

  if (name === "currents") {
    const investmentNews = String(env.NEWS_CATEGORY || "investment").toLowerCase() === "investment";
    return {
      name,
      apiKey: env.CURRENTS_API_KEY,
      configured: Boolean(env.CURRENTS_API_KEY),
      fetchPages: fetchCurrentsPages,
      fetchOptions: {
        category: investmentNews ? "economy_business_finance" : "politics_government",
        outputCategory: investmentNews ? "investment" : "politics",
        language: env.NEWS_LANGUAGE || "th",
        country: env.NEWS_COUNTRY || "TH",
      },
    };
  }

  if (name === "rss") {
    return {
      name,
      apiKey: null,
      feeds: parseRssFeeds(env.RSS_FEEDS),
      configured: parseRssFeeds(env.RSS_FEEDS).length > 0,
      fetchPages: fetchRssPages,
      fetchOptions: { categories: INVESTMENT_RSS_CATEGORIES, outputCategory: "investment" },
    };
  }

  return { name, apiKey: null, configured: false, fetchPages: null };
}

export function isNewsProviderConfigured(env = process.env) {
  return getNewsProviderConfig(env).configured;
}
