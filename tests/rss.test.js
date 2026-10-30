import { describe, expect, it, vi } from "vitest";
import { fetchRssPages, parseInvestmentRss, parsePoliticalRss, parseRssFeeds } from "../server/news/rss.js";

describe("optional RSS provider", () => {
  const xml = `<?xml version="1.0"?><rss><channel><item><guid>rss-1</guid><title>ข่าวการเมืองไทย</title><link>https://publisher.example/politics/1</link><description>คำอธิบายข่าว</description><content:encoded><![CDATA[เนื้อหาที่มีจาก RSS]]></content:encoded><category>การเมือง</category><pubDate>Fri, 30 Oct 2026 10:00:00 GMT</pubDate></item><item><guid>rss-2</guid><title>ข่าวกีฬา</title><link>https://publisher.example/sport/2</link><category>กีฬา</category></item></channel></rss>`;

  it("accepts only RSS items with an explicit political category", () => {
    expect(parsePoliticalRss(xml, "https://publisher.example/feed.xml")).toMatchObject([{
      externalId: "rss-1",
      category: "politics",
      description: "คำอธิบายข่าว",
      content: "เนื้อหาที่มีจาก RSS",
    }]);
  });

  it("loads configured feeds without scraping publisher pages", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(xml, { status: 200 }));
    const result = await fetchRssPages({ feeds: ["https://publisher.example/feed.xml"], fetchImpl });
    expect(result.articles).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledWith("https://publisher.example/feed.xml", expect.any(Object));
  });

  it("parses explicit feed configuration", () => {
    expect(parseRssFeeds("https://one.example/feed, https://two.example/rss")).toEqual(["https://one.example/feed", "https://two.example/rss"]);
  });

  it("supports investment feeds only when the item declares a financial category", () => {
    const investmentXml = xml.replace("<category>การเมือง</category>", "<category>finance</category>");
    expect(parseInvestmentRss(investmentXml, "https://publisher.example/feed.xml")[0].category).toBe("investment");
    expect(parsePoliticalRss(investmentXml, "https://publisher.example/feed.xml")).toHaveLength(0);
  });
});
