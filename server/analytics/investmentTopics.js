const STOPWORDS = new Set(["ข่าว", "การ", "ตลาด", "ลงทุน", "นักลงทุน", "ราคา", "ของ", "และ", "ที่", "ใน", "จาก", "กับ", "เป็น", "มี", "ให้", "เพื่อ", "the", "and", "for", "with", "from", "market", "markets", "stock", "stocks", "news"]);

export function tokenizeInvestmentText(text) {
  const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter("th", { granularity: "word" }) : null;
  const raw = segmenter ? [...segmenter.segment(String(text || ""))].filter((part) => part.isWordLike).map((part) => part.segment) : String(text || "").split(/\s+/);
  return raw.map((token) => token.toLocaleLowerCase("th-TH").replace(/[^\p{L}\p{N}_./-]/gu, "")).filter((token) => token.length >= 2 && !/^\d+$/.test(token) && !STOPWORDS.has(token));
}

export function buildInvestmentTopicAnalysis(articles, { limit = 10 } = {}) {
  const terms = new Map();
  for (const article of articles) {
    const uniqueTerms = new Set(tokenizeInvestmentText(article.title));
    for (const term of uniqueTerms) {
      const current = terms.get(term) || { keyword: term, articleCount: 0, articles: [] };
      current.articleCount += 1;
      current.articles.push({ id: article.id, title: article.title, originalUrl: article.originalUrl, publishedAt: article.publishedAt, sourceName: article.sourceName });
      terms.set(term, current);
    }
  }
  return [...terms.values()].filter((item) => item.articleCount >= 2).sort((a, b) => b.articleCount - a.articleCount || a.keyword.localeCompare(b.keyword)).slice(0, limit);
}
