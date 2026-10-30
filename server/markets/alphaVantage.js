const ALPHA_VANTAGE_ENDPOINT = "https://www.alphavantage.co/query";

export class AlphaVantageError extends Error {
  constructor(message, { status = 502, code = "MARKET_PROVIDER_ERROR" } = {}) {
    super(message);
    this.name = "AlphaVantageError";
    this.status = status;
    this.code = code;
  }
}

export function buildAlphaVantageUrl(asset, apiKey, { outputsize = "compact" } = {}) {
  const url = new URL(ALPHA_VANTAGE_ENDPOINT);
  const params = new URLSearchParams({
    function: asset.providerFunction,
    apikey: apiKey,
    outputsize,
    ...asset.providerParams,
  });
  if (["GOLD_SILVER_HISTORY", "TIME_SERIES_DAILY"].includes(asset.providerFunction)) {
    params.set("symbol", asset.providerSymbol);
  }
  if (asset.providerFunction === "GOLD_SILVER_HISTORY") params.set("interval", "daily");
  if (asset.providerFunction === "WTI") params.set("interval", "daily");
  url.search = params.toString();
  return url;
}

function asText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value) {
  const text = asText(value);
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) ? null : text;
}

function findTimeSeries(payload) {
  const key = Object.keys(payload || {}).find((candidate) => candidate.toLowerCase().includes("time series"));
  return key && payload[key] && typeof payload[key] === "object" ? payload[key] : null;
}

export function normalizeAlphaVantageObservations(payload, asset) {
  const timeSeries = findTimeSeries(payload);
  const rawRows = timeSeries
    ? Object.entries(timeSeries).map(([date, values]) => ({ date, values }))
    : Array.isArray(payload?.data) ? payload.data.map((row) => ({ date: row.date, values: row })) : [];

  return rawRows.map(({ date, values }) => {
    const normalizedDate = normalizeDate(date);
    const value = (key) => values?.[key] ?? values?.[key.replace(/^\d\. /, "")];
    const close = asNumber(value("4. close")) ?? asNumber(value("value"));
    if (!normalizedDate || close === null || close <= 0) return null;

    return {
      symbol: asset.symbol,
      priceDate: normalizedDate,
      open: asNumber(value("1. open")),
      high: asNumber(value("2. high")),
      low: asNumber(value("3. low")),
      close,
      adjustedClose: asNumber(value("5. adjusted close")) ?? close,
      volume: asNumber(value("5. volume")) ?? asNumber(value("6. volume")),
      quoteCurrency: asset.quoteCurrency,
      unit: asset.unit,
      source: "alpha_vantage",
    };
  }).filter(Boolean).sort((a, b) => a.priceDate.localeCompare(b.priceDate));
}

function providerError(payload, response) {
  if (payload?.Note) return new AlphaVantageError("Alpha Vantage rate limit reached", { status: 429, code: "MARKET_RATE_LIMITED" });
  if (payload?.Information) return new AlphaVantageError("Alpha Vantage feature or plan is unavailable", { status: 403, code: "MARKET_FEATURE_UNAVAILABLE" });
  if (payload?.["Error Message"]) return new AlphaVantageError("Alpha Vantage rejected the market request", { status: response.status >= 400 ? response.status : 400, code: "MARKET_PROVIDER_ERROR" });
  return new AlphaVantageError("Alpha Vantage returned no usable market data", { status: response.status >= 400 ? response.status : 502, code: "MARKET_EMPTY_RESPONSE" });
}

export async function fetchAlphaVantageAsset({
  asset,
  apiKey = process.env.ALPHA_VANTAGE_API_KEY,
  fetchImpl = fetch,
  outputsize = "compact",
} = {}) {
  if (!apiKey) throw new AlphaVantageError("Alpha Vantage API key is not configured", { status: 503, code: "MARKET_API_NOT_CONFIGURED" });
  if (!asset?.providerFunction) throw new AlphaVantageError("Market asset provider configuration is incomplete", { status: 500, code: "MARKET_ASSET_NOT_CONFIGURED" });

  let response;
  try {
    response = await fetchImpl(buildAlphaVantageUrl(asset, apiKey, { outputsize }), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new AlphaVantageError("Unable to reach Alpha Vantage", { code: "MARKET_PROVIDER_UNREACHABLE" });
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new AlphaVantageError("Alpha Vantage returned invalid JSON");
  }

  const observations = normalizeAlphaVantageObservations(payload, asset);
  if (!response.ok || payload?.Note || payload?.Information || payload?.["Error Message"] || !observations.length) {
    throw providerError(payload, response);
  }
  return { asset, observations, fetchedAt: new Date().toISOString() };
}

export { ALPHA_VANTAGE_ENDPOINT };
