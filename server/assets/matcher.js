function normalizeText(value) {
  return String(value || "").toLocaleLowerCase("th-TH");
}

function hasAny(text, aliases) {
  return aliases.some((alias) => text.includes(alias.toLocaleLowerCase("th-TH")));
}

function hasMarketContext(text) {
  return hasAny(text, ["หุ้น", "stock", "share", "ตลาด", "ลงทุน", "นักลงทุน", "กำไร", "รายได้", "earnings", "financial", "ราคา"]);
}

export function matchesAsset(text, asset) {
  const normalized = normalizeText(text);
  const symbol = String(asset.symbol || "").toUpperCase();
  if (symbol === "XAU") return hasAny(normalized, ["xau/usd", "xauusd", "ทองคำ", "ราคาทอง", "gold"]);
  if (symbol === "WTI") return hasAny(normalized, ["wti", "west texas intermediate", "น้ำมันดิบ wti"]);
  if (symbol === "USDTHB") {
    return hasAny(normalized, ["usd/thb", "usdthb", "ดอลลาร์สหรัฐ/บาท", "ดอลลาร์/บาท", "เงินบาทต่อดอลลาร์"])
      || (hasAny(normalized, ["ดอลลาร์สหรัฐ", "us dollar", "usd"]) && hasAny(normalized, ["เงินบาท", "บาทไทย", "thb", "thai baht"]));
  }
  if (symbol === "AAPL") return hasAny(normalized, ["aapl", "apple inc.", "apple หุ้น", "apple stock"]) || (hasAny(normalized, ["apple"]) && hasMarketContext(normalized));
  if (symbol === "MSFT") return hasAny(normalized, ["msft", "microsoft corporation", "microsoft หุ้น", "microsoft stock"]) || (hasAny(normalized, ["microsoft"]) && hasMarketContext(normalized));
  if (symbol === "VOO") return hasAny(normalized, ["voo", "vanguard s&p 500", "vanguard s&p500", "voo etf"]);
  return false;
}

export function findAssetMatches(article, assets) {
  const text = [article.title, article.description, article.content].filter(Boolean).join("\n");
  return assets.filter((asset) => matchesAsset(text, asset)).map((asset) => ({
    assetId: asset.id,
    symbol: asset.symbol,
    relationType: "mentioned",
    taggingMethod: "name_match",
  }));
}
