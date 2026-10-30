import { describe, expect, it } from "vitest";
import { buildPartyAssociationQuery, findPartyMatches, normalizePartyMatchText } from "../server/parties/matcher.js";

const parties = [
  { id: "party-1", party_code: "DEMO", name: "พรรคตัวอย่าง", short_name: "ตย." },
  { id: "party-2", party_code: "OTHER", name: "พรรคอื่น", short_name: "อน." },
];

describe("political party association suggestions", () => {
  it("normalizes Thai punctuation and zero-width characters", () => {
    expect(normalizePartyMatchText(" พรรค\u200bตัวอย่าง ")).toBe("พรรคตัวอย่าง");
  });

  it("matches only party names and verified aliases in title and description", () => {
    expect(findPartyMatches({ title: "นโยบายของ ตย.", description: "รายละเอียด" }, parties)).toEqual([
      { partyId: "party-1", partyCode: "DEMO", relationType: "mentioned", taggingMethod: "name_match" },
    ]);
    expect(findPartyMatches({ title: "นักการเมืองคนหนึ่งให้สัมภาษณ์", description: "ไม่มีชื่อพรรค" }, parties)).toEqual([]);
  });

  it("supports an explicitly supplied verified alias without creating party records", () => {
    expect(findPartyMatches({ title: "ข่าวของ พตย.", description: null }, parties, { DEMO: ["พตย."] })).toHaveLength(1);
  });

  it("returns each matched party once", () => {
    expect(findPartyMatches({ title: "พรรคตัวอย่าง ตย.", description: "พรรคตัวอย่าง" }, parties)).toHaveLength(1);
  });

  it("creates pending, deduplicated association queries", () => {
    const result = buildPartyAssociationQuery({ articleId: "article-1", partyId: "party-1" });

    expect(result.values).toEqual(["article-1", "party-1", "mentioned", "name_match"]);
    expect(result.text).toContain("is_reviewed");
    expect(result.text).toContain("ON CONFLICT (article_id, party_id) DO NOTHING");
  });
});
