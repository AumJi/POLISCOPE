import express from "express";
import { isDatabaseConfigured } from "../db/pool.js";
import { calculateMarketAnalytics } from "./analytics.js";
import { findMarketAsset } from "./assets.js";
import { getMarketHistory, listMarketAssets } from "./repository.js";
import { ingestMarkets, isMarketIngestionRunning } from "./service.js";

const router = express.Router();
const RANGE_DAYS = Object.freeze({ "7d": 7, "30d": 30, "90d": 90 });

function requireDatabase(response) {
  if (!isDatabaseConfigured) {
    response.status(503).json({ error: "Database is not configured" });
    return false;
  }
  return true;
}

function getRange(value) {
  const key = value || "30d";
  if (!Object.hasOwn(RANGE_DAYS, key)) {
    const error = new Error("range must be 7d, 30d, or 90d");
    error.status = 400;
    error.code = "INVALID_MARKET_RANGE";
    throw error;
  }
  return { key, days: RANGE_DAYS[key] };
}

function validSymbol(value) {
  return typeof value === "string" && /^[A-Z0-9]{2,12}$/.test(value);
}

router.get("/", async (_request, response, next) => {
  if (!requireDatabase(response)) return;
  try {
    response.json({ assets: await listMarketAssets() });
  } catch (error) { next(error); }
});

router.get("/:symbol/history", async (request, response, next) => {
  if (!requireDatabase(response)) return;
  const symbol = String(request.params.symbol || "").toUpperCase();
  if (!validSymbol(symbol) || !findMarketAsset(symbol)) return response.status(400).json({ error: "Invalid market asset symbol" });
  try {
    const range = getRange(request.query.range);
    const observations = await getMarketHistory(symbol, range.days);
    response.json({ symbol, selectedRange: range.key, observations });
  } catch (error) { next(error); }
});

router.get("/:symbol/analytics", async (request, response, next) => {
  if (!requireDatabase(response)) return;
  const symbol = String(request.params.symbol || "").toUpperCase();
  if (!validSymbol(symbol) || !findMarketAsset(symbol)) return response.status(400).json({ error: "Invalid market asset symbol" });
  try {
    const range = getRange(request.query.range);
    const observations = await getMarketHistory(symbol, range.days);
    response.json({ symbol, selectedRange: range.key, analytics: calculateMarketAnalytics(observations), observations });
  } catch (error) { next(error); }
});

router.get("/cron/ingest", async (request, response, next) => {
  if (!process.env.CRON_SECRET) return response.status(503).json({ error: "Cron secret is not configured" });
  if (request.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return response.status(401).json({ error: "Unauthorized" });
  if (!isDatabaseConfigured || !process.env.ALPHA_VANTAGE_API_KEY) return response.status(503).json({ error: "Market ingestion is not configured" });
  if (isMarketIngestionRunning()) return response.status(409).json({ error: "Market ingestion is already running" });
  try { response.json({ ok: true, ...(await ingestMarkets()) }); } catch (error) { next(error); }
});

export default router;
