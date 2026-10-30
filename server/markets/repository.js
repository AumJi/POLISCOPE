import { query, withTransaction } from "../db/query.js";
import { MARKET_ASSETS } from "./assets.js";

function mapAsset(row) {
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    assetType: row.asset_type,
    category: row.category,
    providerSymbol: row.provider_symbol,
    providerFunction: row.provider_function,
    quoteCurrency: row.quote_currency,
    unit: row.unit,
    latest: row.latest_date ? { priceDate: row.latest_date, close: Number(row.latest_close) } : null,
  };
}

export async function listMarketAssets() {
  const result = await query(`
    SELECT ma.*, latest.price_date AS latest_date, latest.close AS latest_close
    FROM market_assets ma
    LEFT JOIN LATERAL (
      SELECT price_date, close
      FROM market_prices
      WHERE asset_id = ma.id
      ORDER BY price_date DESC
      LIMIT 1
    ) latest ON true
    ORDER BY CASE ma.symbol WHEN 'XAU' THEN 1 WHEN 'WTI' THEN 2 WHEN 'USDTHB' THEN 3 WHEN 'AAPL' THEN 4 WHEN 'MSFT' THEN 5 WHEN 'VOO' THEN 6 ELSE 99 END, ma.symbol
  `);
  return result.rows.map(mapAsset);
}

export async function getMarketHistory(symbol, days) {
  const result = await query(`
    SELECT
      ma.symbol,
      ma.name,
      ma.asset_type,
      ma.category,
      ma.quote_currency,
      ma.unit,
      mp.price_date,
      mp.open,
      mp.high,
      mp.low,
      mp.close,
      mp.adjusted_close,
      mp.volume,
      mp.source,
      mp.fetched_at
    FROM market_assets ma
    INNER JOIN market_prices mp ON mp.asset_id = ma.id
    WHERE ma.symbol = $1
      AND mp.price_date >= CURRENT_DATE - ($2::int - 1)
    ORDER BY mp.price_date ASC
  `, [symbol, days]);
  return result.rows.map((row) => ({
    symbol: row.symbol,
    name: row.name,
    assetType: row.asset_type,
    category: row.category,
    quoteCurrency: row.quote_currency,
    unit: row.unit,
    priceDate: row.price_date,
    open: row.open === null ? null : Number(row.open),
    high: row.high === null ? null : Number(row.high),
    low: row.low === null ? null : Number(row.low),
    close: Number(row.close),
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
      INSERT INTO market_assets (symbol, name, asset_type, category, provider_symbol, provider_function, quote_currency, unit)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (symbol) DO UPDATE SET
        name = EXCLUDED.name,
        asset_type = EXCLUDED.asset_type,
        category = EXCLUDED.category,
        provider_symbol = EXCLUDED.provider_symbol,
        provider_function = EXCLUDED.provider_function,
        quote_currency = EXCLUDED.quote_currency,
        unit = EXCLUDED.unit
      RETURNING id, symbol
    `, [asset.symbol, asset.name, asset.assetType, asset.category, asset.providerSymbol, asset.providerFunction, asset.quoteCurrency, asset.unit]);
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
            asset_id, price_date, open, high, low, close, adjusted_close, volume,
            quote_currency, unit, source, fetched_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
          ON CONFLICT (asset_id, price_date) DO UPDATE SET
            open = EXCLUDED.open,
            high = EXCLUDED.high,
            low = EXCLUDED.low,
            close = EXCLUDED.close,
            adjusted_close = EXCLUDED.adjusted_close,
            volume = EXCLUDED.volume,
            quote_currency = EXCLUDED.quote_currency,
            unit = EXCLUDED.unit,
            source = EXCLUDED.source,
            fetched_at = NOW()
        `, [assetId, observation.priceDate, observation.open, observation.high, observation.low, observation.close, observation.adjustedClose, observation.volume, observation.quoteCurrency, observation.unit, observation.source]);
        saved += 1;
      }
    }
    return saved;
  });
}
