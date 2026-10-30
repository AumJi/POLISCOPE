import { query, withTransaction } from "../db/query.js";
import { MARKET_ASSETS } from "./assets.js";

function mapAsset(row) {
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    assetType: row.asset_class,
    category: row.asset_class,
    providerSymbol: row.provider_symbol,
    providerFunction: null,
    quoteCurrency: row.currency_code,
    unit: row.quote_unit,
    latest: row.latest_date ? { priceDate: row.latest_date, close: Number(row.latest_close) } : null,
  };
}

export async function listMarketAssets() {
  const result = await query(`
    SELECT ma.*, latest.price_date AS latest_date, latest.close_price AS latest_close
    FROM market_assets ma
    LEFT JOIN LATERAL (
      SELECT price_date, close_price
      FROM market_prices
      WHERE asset_id = ma.id
      ORDER BY price_date DESC
      LIMIT 1
    ) latest ON true
    ORDER BY CASE ma.symbol WHEN 'XAUUSD' THEN 1 WHEN 'WTI' THEN 2 WHEN 'USDTHB' THEN 3 WHEN 'AAPL' THEN 4 WHEN 'MSFT' THEN 5 WHEN 'VOO' THEN 6 ELSE 99 END, ma.symbol
  `);
  return result.rows.map(mapAsset);
}

export async function getMarketHistory(symbol, days) {
  const result = await query(`
    SELECT
      ma.symbol,
      ma.name,
      ma.asset_class,
      ma.currency_code,
      ma.quote_unit,
      mp.price_date,
      mp.open_price,
      mp.high_price,
      mp.low_price,
      mp.close_price,
      NULL AS adjusted_close,
      mp.volume,
      ma.data_provider AS source,
      mp.retrieved_at AS fetched_at
    FROM market_assets ma
    INNER JOIN market_prices mp ON mp.asset_id = ma.id
    WHERE ma.symbol = $1
      AND mp.price_date >= CURRENT_DATE - ($2::int - 1)
    ORDER BY mp.price_date ASC
  `, [symbol, days]);
  return result.rows.map((row) => ({
    symbol: row.symbol,
    name: row.name,
    assetType: row.asset_class,
    category: row.asset_class,
    quoteCurrency: row.currency_code,
    unit: row.quote_unit,
    priceDate: row.price_date,
    open: row.open_price === null ? null : Number(row.open_price),
    high: row.high_price === null ? null : Number(row.high_price),
    low: row.low_price === null ? null : Number(row.low_price),
    close: Number(row.close_price),
    adjustedClose: row.adjusted_close === null ? null : Number(row.adjusted_close),
    volume: row.volume === null ? null : Number(row.volume),
    source: row.source,
    fetchedAt: row.fetched_at,
  }));
}

export async function upsertMarketAssets(client) {
  const rows = [];
  for (const asset of MARKET_ASSETS) {
    const result = await client.query(`
      INSERT INTO market_assets (symbol, name, asset_class, currency_code, quote_unit, data_provider, provider_symbol, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      ON CONFLICT (symbol) DO UPDATE SET
        name = EXCLUDED.name,
        asset_class = EXCLUDED.asset_class,
        currency_code = EXCLUDED.currency_code,
        quote_unit = EXCLUDED.quote_unit,
        data_provider = EXCLUDED.data_provider,
        provider_symbol = EXCLUDED.provider_symbol,
        is_active = true
      RETURNING id, symbol
    `, [asset.symbol, asset.name, asset.assetType, asset.quoteCurrency, asset.unit, "alphavantage", asset.providerSymbol]);
    rows.push(result.rows[0]);
  }
  return rows;
}

export async function persistMarketObservations(results) {
  return withTransaction(async (client) => {
    const assetRows = await upsertMarketAssets(client);
    const assetIds = new Map(assetRows.map((row) => [row.symbol, row.id]));
    let saved = 0;
    for (const result of results) {
      const assetId = assetIds.get(result.asset.symbol);
      if (!assetId) continue;
      for (const observation of result.observations) {
        await client.query(`
          INSERT INTO market_prices (
            asset_id, price_date, open_price, high_price, low_price, close_price, volume, retrieved_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (asset_id, price_date) DO UPDATE SET
            open_price = EXCLUDED.open_price,
            high_price = EXCLUDED.high_price,
            low_price = EXCLUDED.low_price,
            close_price = EXCLUDED.close_price,
            volume = EXCLUDED.volume,
            retrieved_at = NOW()
        `, [assetId, observation.priceDate, observation.open, observation.high, observation.low, observation.close, observation.volume]);
        saved += 1;
      }
    }
    return saved;
  });
}
