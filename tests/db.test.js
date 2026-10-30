import { describe, expect, it } from "vitest";
import { buildNewsQuery, mapArticleRow } from "../server/db/repository.js";

describe("database repository", () => {
  it("builds a parameterized news query with a party filter", () => {
    const result = buildNewsQuery({ partyCode: "DEMO", limit: 5 });

    expect(result.values).toEqual(["DEMO", 5]);
    expect(result.text).toContain("filter_party.party_code = $1");
    expect(result.text).toContain("LIMIT $2");
    expect(result.text).not.toContain("'DEMO'");
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
});
