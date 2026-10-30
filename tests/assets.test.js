import { describe, expect, it } from "vitest";
import { findAssetMatches, matchesAsset } from "../server/assets/matcher.js";

const assets = [
  { id: "gold-id", symbol: "XAU" },
  { id: "fx-id", symbol: "USDTHB" },
  { id: "apple-id", symbol: "AAPL" },
  { id: "voo-id", symbol: "VOO" },
];

describe("investment asset matching", () => {
  it("matches explicit gold, FX pair, stock, and ETF context", () => {
    expect(matchesAsset("ราคาทองคำ XAU/USD ปรับตัวสูงขึ้น", { symbol: "XAU" })).toBe(true);
    expect(matchesAsset("USD/THB ขยับจากเงินบาทอ่อนค่า", { symbol: "USDTHB" })).toBe(true);
    expect(matchesAsset("Apple หุ้น AAPL รายงานกำไร", { symbol: "AAPL" })).toBe(true);
    expect(matchesAsset("นักลงทุนจับตา VOO ETF", { symbol: "VOO" })).toBe(true);
  });

  it("does not infer USD/THB from USD alone or Apple product news", () => {
    expect(matchesAsset("USD แข็งค่าทั่วโลก", { symbol: "USDTHB" })).toBe(false);
    expect(matchesAsset("Apple เปิดตัว iPhone รุ่นใหม่", { symbol: "AAPL" })).toBe(false);
  });

  it("returns each matched asset once", () => {
    expect(findAssetMatches({ title: "ราคาทองคำและ USD/THB", description: "", content: "" }, assets)).toEqual([
      expect.objectContaining({ symbol: "XAU", taggingMethod: "name_match" }),
      expect.objectContaining({ symbol: "USDTHB", taggingMethod: "name_match" }),
    ]);
  });
});
