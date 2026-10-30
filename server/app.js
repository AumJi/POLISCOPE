import express from "express";
import { isDatabaseConfigured } from "./db/pool.js";
import { listNews, listParties } from "./db/repository.js";
import { refreshNews } from "./news/service.js";

const app = express();

app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "poliscope-api",
    environment: {
      database: isDatabaseConfigured,
      newsApi: Boolean(process.env.NEWS_API_KEY),
      typhoonApi: Boolean(process.env.TYPHOON_API_KEY),
    },
  });
});

app.get("/api/news", async (request, response, next) => {
  const partyCode = typeof request.query.party === "string" ? request.query.party.trim() : undefined;

  if (partyCode && !/^[a-zA-Z0-9_-]{1,120}$/.test(partyCode)) {
    return response.status(400).json({ error: "Invalid party code" });
  }

  if (!isDatabaseConfigured) {
    return response.status(503).json({ error: "Database is not configured" });
  }

  let refresh = { refreshed: false };
  let refreshError = null;

  try {
    refresh = await refreshNews();
  } catch (error) {
    refreshError = error;
  }

  try {
    const articles = await listNews({ partyCode, limit: 10 });
    if (refreshError && articles.length === 0) throw refreshError;

    response.json({
      articles,
      meta: {
        count: articles.length,
        refreshed: refresh.refreshed,
        cached: refresh.cached ?? false,
        stale: Boolean(refreshError),
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/parties", async (_request, response, next) => {
  if (!isDatabaseConfigured) {
    return response.status(503).json({ error: "Database is not configured" });
  }

  try {
    response.json({ parties: await listParties() });
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  const status = Number.isInteger(error.status) ? error.status : 500;
  response.status(status).json({ error: error.message || "Internal server error", code: error.code || "INTERNAL_ERROR" });
});

export default app;
