import { describe, expect, it } from "vitest";
import { ARTICLE_EXCERPT_NOTICE, getOriginalArticleText, getSafeExternalUrl } from "../src/App.jsx";

describe("article detail content rules", () => {
  it("allows only safe external HTTP(S) URLs", () => {
    expect(getSafeExternalUrl("https://example.com/article")).toBe("https://example.com/article");
    expect(getSafeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(getSafeExternalUrl("not-a-url")).toBeNull();
  });

  it("prefers original content and falls back to an excerpt", () => {
    expect(getOriginalArticleText({ content: "Full content", description: "Excerpt" })).toEqual({ text: "Full content", isExcerpt: false });
    expect(getOriginalArticleText({ content: null, description: "Excerpt" })).toEqual({ text: "Excerpt", isExcerpt: true });
    expect(getOriginalArticleText({ content: null, description: null })).toEqual({ text: "", isExcerpt: false });
    expect(ARTICLE_EXCERPT_NOTICE).toContain("เนื้อหาย่อจากสำนักข่าว");
  });
});
