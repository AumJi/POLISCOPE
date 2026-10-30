const MOCK_ASSETS = Object.freeze({
  XAUUSD: { name: "Gold / XAUUSD", assetType: "gold", quoteCurrency: "USD", unit: "USD per troy ounce", base: 2650 },
  WTI: { name: "West Texas Intermediate", assetType: "oil", quoteCurrency: "USD", unit: "USD per barrel", base: 72 },
  USDTHB: { name: "US Dollar / Thai Baht", assetType: "forex", quoteCurrency: "THB", unit: "THB per USD", base: 33.5 },
  AAPL: { name: "Apple Inc.", assetType: "stock", quoteCurrency: "USD", unit: "USD per share", base: 230 },
  MSFT: { name: "Microsoft Corporation", assetType: "stock", quoteCurrency: "USD", unit: "USD per share", base: 510 },
  VOO: { name: "Vanguard S&P 500 ETF", assetType: "etf", quoteCurrency: "USD", unit: "USD per share", base: 610 },
});

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function movingAverage(observations, period) {
  return observations.map((observation, index) => {
    const values = observations.slice(Math.max(0, index - period + 1), index + 1).map((item) => item.close);
    return { date: observation.priceDate, value: values.length >= Math.min(period, 2) ? average(values) : null };
  });
}

function volatility(observations) {
  const returns = observations.slice(1).map((observation, index) => (observation.close - observations[index].close) / observations[index].close);
  if (returns.length < 2) return null;
  const mean = average(returns);
  return Math.sqrt(returns.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (returns.length - 1));
}

export function calculateMockMarketAnalytics(observations) {
  const earliest = observations[0];
  const latest = observations.at(-1);
  const sma7 = movingAverage(observations, 7);
  const sma30 = movingAverage(observations, 30);
  return {
    available: observations.length > 0,
    observationCount: observations.length,
    earliestDate: earliest?.priceDate || null,
    latestDate: latest?.priceDate || null,
    earliestClose: earliest?.close ?? null,
    latestClose: latest?.close ?? null,
    percentageChange: earliest ? ((latest.close - earliest.close) / earliest.close) * 100 : null,
    volatility: volatility(observations),
    sma7: sma7.at(-1)?.value ?? null,
    sma30: sma30.at(-1)?.value ?? null,
    movingAverages: { sma7, sma30 },
    isMock: true,
  };
}

export function getMockMarketData(symbol, range = "30d") {
  const definition = MOCK_ASSETS[symbol] || { ...MOCK_ASSETS.MSFT, name: symbol };
  const days = { "7d": 7, "30d": 30, "90d": 90 }[range] || 30;
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const observations = Array.from({ length: days }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - (days - index - 1));
    const trend = 1 + (index / Math.max(days - 1, 1)) * 0.045;
    const wave = 1 + Math.sin((index + symbol.length) / 2.8) * 0.012;
    const close = Number((definition.base * trend * wave).toFixed(4));
    return { symbol, priceDate: date.toISOString().slice(0, 10), open: close * 0.998, high: close * 1.006, low: close * 0.994, close, adjustedClose: close, volume: null, source: "local_demo", fetchedAt: new Date().toISOString() };
  });
  return { observations, analytics: calculateMockMarketAnalytics(observations) };
}

export function getMockMarketAsset(symbol) {
  const definition = MOCK_ASSETS[symbol];
  if (!definition) return null;
  const data = getMockMarketData(symbol, "30d");
  return { symbol, name: definition.name, assetType: definition.assetType, category: definition.assetType, quoteCurrency: definition.quoteCurrency, unit: definition.unit, latest: { priceDate: data.analytics.latestDate, close: data.analytics.latestClose }, isDemo: true };
}
