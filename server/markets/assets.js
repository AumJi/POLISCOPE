export const MARKET_ASSETS = Object.freeze([
  {
    symbol: "XAUUSD",
    name: "Gold / XAUUSD",
    assetType: "gold",
    category: "gold",
    providerSymbol: "XAU",
    providerFunction: "GOLD_SILVER_HISTORY",
    quoteCurrency: "USD",
    unit: "USD per troy ounce",
    providerParams: { interval: "daily" },
  },
  {
    symbol: "WTI",
    name: "West Texas Intermediate",
    // Keep this value aligned with the deployed Supabase CHECK constraint.
    assetType: "oil",
    category: "oil",
    providerSymbol: "WTI",
    providerFunction: "WTI",
    quoteCurrency: "USD",
    unit: "USD per barrel",
    providerParams: { interval: "daily" },
  },
  {
    symbol: "USDTHB",
    name: "US Dollar / Thai Baht",
    assetType: "forex",
    category: "forex",
    providerSymbol: "USD/THB",
    providerFunction: "FX_DAILY",
    quoteCurrency: "THB",
    unit: "THB per USD",
    providerParams: { from_symbol: "USD", to_symbol: "THB" },
  },
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    assetType: "stock",
    category: "stocks",
    providerSymbol: "AAPL",
    providerFunction: "TIME_SERIES_DAILY",
    quoteCurrency: "USD",
    unit: "USD per share",
    providerParams: {},
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corporation",
    assetType: "stock",
    category: "stocks",
    providerSymbol: "MSFT",
    providerFunction: "TIME_SERIES_DAILY",
    quoteCurrency: "USD",
    unit: "USD per share",
    providerParams: {},
  },
  {
    symbol: "VOO",
    name: "Vanguard S&P 500 ETF",
    assetType: "etf",
    category: "funds",
    providerSymbol: "VOO",
    providerFunction: "TIME_SERIES_DAILY",
    quoteCurrency: "USD",
    unit: "USD per share",
    providerParams: {},
  },
]);

export function findMarketAsset(symbol) {
  const normalized = String(symbol || "").trim().toLowerCase();
  return MARKET_ASSETS.find((asset) => asset.symbol.toLowerCase() === normalized || (normalized === "xau" && asset.symbol === "XAUUSD"));
}
