import { describe, expect, it } from "vitest";
import { buildNewsCountQuery, buildNewsQuery, mapArticleRow, mapPartyRow } from "../server/db/repository.js";

describe("database repository", () => {
  it("builds a parameterized news query with a party filter", () => {
    const result = buildNewsQuery({ partyCode: "DEMO", limit: 5 });

    expect(result.values).toEqual(["DEMO", 5]);
    expect(result.text).toContain("filter_party.party_code = $1");
    expect(result.text).toContain("LIMIT $2");
    expect(result.text).toContain("LOWER(a.category)");
    expect(result.text).toContain("politics");
    expect(result.text).not.toContain("'DEMO'");
  });

  it("counts only political articles while preserving party filtering", () => {
    const result = buildNewsCountQuery({ partyCode: "DEMO" });

    expect(result.values).toEqual(["DEMO"]);
    expect(result.text).toContain("COUNT(*)::int");
    expect(result.text).toContain("LOWER(a.category)");
    expect(result.text).toContain("filter_party.party_code = $1");
  });

  it("maps database column names to API names and defaults parties", () => {
    expect(mapArticleRow({
      id: "article-id",
      external_id: "provider-id",
      title: "Title",
      description: null,
      content: "Content",
      original_url: "https://example.com/article",
      image_url: null,
      category: "politics",
      published_at: "2025-01-01T00:00:00.000Z",
      fetched_at: "2025-01-01T00:00:00.000Z",
      source: { name: "Example" },
      parties: null,
    })).toMatchObject({
      id: "article-id",
      externalId: "provider-id",
      originalUrl: "https://example.com/article",
      parties: [],
    });
  });

  it("keeps original content separate from a description", () => {
    expect(mapArticleRow({
      id: "article-id",
      external_id: null,
      title: "Title",
      description: "Excerpt only",
      content: null,
      original_url: "https://example.com/article",
      image_url: null,
      category: "politics",
      published_at: null,
      fetched_at: null,
      source: {},
      parties: [],
    })).toMatchObject({ description: "Excerpt only", content: null });
  });

  it("maps party records for the public API", () => {
    expect(mapPartyRow({
      id: "party-id",
      party_code: "DEMO",
      name: "Demo Party",
      short_name: "Demo",
      country_code: "TH",
      official_website_url: "https://example.com",
      logo_url: null,
    })).toEqual({
      id: "party-id",
      code: "DEMO",
      name: "Demo Party",
      shortName: "Demo",
      countryCode: "TH",
      officialWebsiteUrl: "https://example.com",
      logoUrl: null,
    });
  });
});
