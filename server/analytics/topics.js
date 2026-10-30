const STOPWORDS = new Set([
  "ข่าว", "การเมือง", "วันนี้", "เรื่อง", "กรณี", "ของ", "ที่", "และ", "หรือ", "จาก", "ใน", "เป็น", "มี", "ให้", "ได้", "กับ", "โดย", "แล้ว", "ยัง", "ไป", "มา", "อย่าง", "นาย", "นาง", "นางสาว", "เวลา", "ครั้ง", "คน", "การ", "ความ", "เพื่อ", "เมื่อ", "ซึ่ง", "อาจ", "จะ", "ว่า", "แต่", "ทั้ง", "นี้", "นั้น", "ไม่", "มาก", "อยู่", "ทำ", "ผ่าน", "พรรค", "รัฐบาล", "ประเทศ", "ไทย", "the", "and", "for", "with", "from", "this", "that", "news", "politics",
]);

function getSegmenter() {
  return typeof Intl.Segmenter === "function" ? new Intl.Segmenter("th", { granularity: "word" }) : null;
}

export function tokenizeThaiText(text, segmenter = getSegmenter()) {
  const rawTokens = segmenter
    ? [...segmenter.segment(String(text || ""))].filter((part) => part.isWordLike).map((part) => part.segment)
    : String(text || "").split(/\s+/);

  return rawTokens
    .map((token) => token.toLocaleLowerCase("th-TH").replace(/[^\p{L}\p{N}_-]/gu, ""))
    .filter((token) => token.length >= 2 && !/^\d+$/.test(token) && !STOPWORDS.has(token));
}

function addTerm(map, term, article) {
  if (!term || STOPWORDS.has(term)) return;
  const current = map.get(term) || { keyword: term, articleIds: new Set(), articles: [] };
  if (!current.articleIds.has(article.id)) {
    current.articleIds.add(article.id);
    current.articles.push({
      id: article.id,
      title: article.title,
      originalUrl: article.originalUrl,
      publishedAt: article.publishedAt,
      sourceName: article.sourceName,
    });
  }
  map.set(term, current);
}

export function buildTopicFrequencies(articles, { startDate, endDate } = {}) {
  const frequencies = new Map();
  for (const article of articles) {
    if (startDate && article.publishedDate < startDate) continue;
    if (endDate && article.publishedDate > endDate) continue;
    const tokens = tokenizeThaiText(article.title);
    const terms = new Set(tokens);
    for (let index = 0; index < tokens.length - 1; index += 1) {
      const phrase = `${tokens[index]} ${tokens[index + 1]}`;
      if (!STOPWORDS.has(tokens[index]) && !STOPWORDS.has(tokens[index + 1])) terms.add(phrase);
    }
    for (const term of terms) addTerm(frequencies, term, article);
  }

  return [...frequencies.values()]
    .map((entry) => ({
      keyword: entry.keyword,
      articleCount: entry.articleIds.size,
      articles: entry.articles.slice(0, 5),
    }))
    .sort((left, right) => right.articleCount - left.articleCount || left.keyword.localeCompare(right.keyword, "th"));
}

function subtractDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function buildTopicAnalysis(articles, { selectedDays = 7, analysisEndDate, coverage } = {}) {
  const endDate = analysisEndDate || articles[0]?.publishedDate;
  const recentStart = endDate ? subtractDays(endDate, selectedDays - 1) : null;
  const previousStart = endDate ? subtractDays(endDate, 13) : null;
  const previousEnd = endDate ? subtractDays(endDate, 7) : null;
  const topics = buildTopicFrequencies(articles, { startDate: recentStart, endDate });
  const recent = buildTopicFrequencies(articles, { startDate: recentStart, endDate });
  const previous = buildTopicFrequencies(articles, { startDate: previousStart, endDate: previousEnd });
  const previousMap = new Map(previous.map((topic) => [topic.keyword, topic]));
  const trends = recent
    .map((topic) => {
      const previousTopic = previousMap.get(topic.keyword);
      const previousArticleCount = previousTopic?.articleCount || 0;
      return {
        keyword: topic.keyword,
        recentArticleCount: topic.articleCount,
        previousArticleCount,
        difference: topic.articleCount - previousArticleCount,
        articles: topic.articles,
      };
    })
    .filter((topic) => topic.difference > 0)
    .sort((left, right) => right.difference - left.difference || right.recentArticleCount - left.recentArticleCount)
    .slice(0, 10);

  const trendAvailable = (coverage?.coverageSpanDays || 0) >= 14;
  return {
    topics: topics.slice(0, 12),
    trends: trendAvailable ? trends : [],
    trendAvailable,
    trendReason: trendAvailable ? null : "ต้องมีข้อมูลข่าวที่ครอบคลุมอย่างน้อย 14 วันก่อนเปรียบเทียบแนวโน้ม",
    recentStart,
    previousStart,
    previousEnd,
  };
}
