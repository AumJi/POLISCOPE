import express from "express";
import { isDatabaseConfigured } from "../db/pool.js";
import {
  getAnalyticsOverview,
  getAnalyticsParties,
  getAnalyticsSources,
  getAnalyticsTimeline,
  getPoliticalCoverage,
  getTopicSourceArticles,
  parseAnalyticsRange,
} from "./repository.js";
import { buildTopicAnalysis } from "./topics.js";

const router = express.Router();
const FILTER_PATTERN = /^[a-zA-Z0-9_.-]{1,120}$/;

function getFilters(request) {
  const partyCode = typeof request.query.party === "string" ? request.query.party.trim() : undefined;
  const sourceKey = typeof request.query.source === "string" ? request.query.source.trim() : undefined;

  if (partyCode && !FILTER_PATTERN.test(partyCode)) {
    const error = new Error("Invalid party filter");
    error.status = 400;
    throw error;
  }
  if (sourceKey && !FILTER_PATTERN.test(sourceKey)) {
    const error = new Error("Invalid source filter");
    error.status = 400;
    throw error;
  }
  return { partyCode, sourceKey };
}

function asyncRoute(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

function requireDatabase(_request, response) {
  if (!isDatabaseConfigured) {
    response.status(503).json({ error: "Database is not configured" });
    return false;
  }
  return true;
}

router.get("/overview", asyncRoute(async (request, response) => {
  if (!requireDatabase(request, response)) return;
  const { key } = parseAnalyticsRange(request.query.range, "30d");
  response.json({ overview: await getAnalyticsOverview({ range: key, ...getFilters(request) }) });
}));

router.get("/timeline", asyncRoute(async (request, response) => {
  if (!requireDatabase(request, response)) return;
  const { key } = parseAnalyticsRange(request.query.range, "30d");
  response.json(await getAnalyticsTimeline({ range: key, ...getFilters(request) }));
}));

router.get("/parties", asyncRoute(async (request, response) => {
  if (!requireDatabase(request, response)) return;
  const { key } = parseAnalyticsRange(request.query.range, "30d");
  response.json(await getAnalyticsParties({ range: key, ...getFilters(request) }));
}));

router.get("/sources", asyncRoute(async (request, response) => {
  if (!requireDatabase(request, response)) return;
  const { key } = parseAnalyticsRange(request.query.range, "30d");
  response.json(await getAnalyticsSources({ range: key, ...getFilters(request) }));
}));

router.get("/topics", asyncRoute(async (request, response) => {
  if (!requireDatabase(request)) return;
  const { key, days } = parseAnalyticsRange(request.query.range, "7d");
  const filters = getFilters(request);
  const [topicData, coverage] = await Promise.all([
    getTopicSourceArticles({ days: Math.max(days, 14), ...filters }),
    getPoliticalCoverage(filters),
  ]);

  let coverageSpanDays = 0;
  if (coverage.earliestDate && coverage.latestDate) {
    coverageSpanDays = Math.floor((new Date(`${coverage.latestDate}T00:00:00Z`) - new Date(`${coverage.earliestDate}T00:00:00Z`)) / 86_400_000) + 1;
  }
  const analysis = buildTopicAnalysis(topicData.articles, {
    selectedDays: days,
    analysisEndDate: topicData.analysisEndDate,
    coverage: { ...coverage, coverageSpanDays },
  });

  response.json({
    selectedRange: key,
    analysisType: "keyword_frequency",
    coverage: { ...coverage, coverageSpanDays },
    topics: analysis.topics,
    trends: analysis.trends,
    trendAvailable: analysis.trendAvailable,
    trendReason: analysis.trendReason,
  });
}));

export default router;
