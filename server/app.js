import express from "express";
import { isDatabaseConfigured } from "./db/pool.js";
import { countNews, findArticleById, listNews, listParties } from "./db/repository.js";
import {
  buildSummaryInput,
  createTyphoonClient,
  findCachedSummary,
  hashSummaryInput,
  isUuid,
  saveSummary,
  streamSummary,
} from "./ai/summarize.js";
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
    const [articles, total] = await Promise.all([
      listNews({ partyCode, limit: 10 }),
      countNews({ partyCode }),
    ]);
    if (refreshError && articles.length === 0) throw refreshError;

    response.json({
      articles,
      meta: {
        count: articles.length,
        total,
        refreshed: refresh.refreshed,
        cached: refresh.cached ?? false,
        stale: Boolean(refreshError),
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/news/:id", async (request, response, next) => {
  if (!isUuid(request.params.id)) {
    return response.status(400).json({ error: "Article id must be a valid UUID" });
  }

  if (!isDatabaseConfigured) {
    return response.status(503).json({ error: "Database is not configured" });
  }

  try {
    const article = await findArticleById(request.params.id);
    if (!article) return response.status(404).json({ error: "Article not found" });
    response.json({ article });
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

function writeSseEvent(response, event, data) {
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

app.post("/api/summarize", async (request, response) => {
  const articleId = request.body?.articleId;

  if (!isUuid(articleId)) {
    return response.status(400).json({ error: "articleId must be a valid UUID" });
  }

  if (!isDatabaseConfigured) {
    return response.status(503).json({ error: "Database is not configured" });
  }

  let article;
  try {
    article = await findArticleById(articleId);
  } catch (error) {
    return response.status(500).json({ error: "Unable to load article", code: error.code || "DATABASE_ERROR" });
  }

  if (!article) {
    return response.status(404).json({ error: "Article not found" });
  }

  const input = buildSummaryInput(article);
  const inputHash = hashSummaryInput(input);
  const modelName = process.env.TYPHOON_MODEL || "typhoon-v2.5-30b-a3b-instruct";

  let cached;
  try {
    cached = await findCachedSummary(articleId, inputHash);
  } catch (error) {
    return response.status(500).json({ error: "Unable to check summary cache", code: error.code || "DATABASE_ERROR" });
  }

  response.status(200);
  response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.setHeader("X-Accel-Buffering", "no");
  response.flushHeaders?.();

  if (cached) {
    writeSseEvent(response, "complete", {
      summary: cached.summaryText,
      cached: true,
      saved: true,
      modelName: cached.modelName,
      createdAt: cached.createdAt,
    });
    return response.end();
  }

  let clientClosed = false;
  response.on("close", () => {
    if (!response.writableEnded) clientClosed = true;
  });

  try {
    const client = createTyphoonClient();
    const summary = await streamSummary({
      article,
      input,
      client,
      model: modelName,
      onDelta: (delta) => {
        if (!clientClosed) writeSseEvent(response, "delta", { text: delta });
      },
    });

    const saved = await saveSummary({ articleId, modelName, inputHash, summaryText: summary });
    if (!clientClosed) {
      writeSseEvent(response, "complete", {
        summary: saved.summaryText,
        cached: false,
        saved: true,
        modelName: saved.modelName,
        createdAt: saved.createdAt,
      });
    }
  } catch (error) {
    if (!clientClosed) {
      writeSseEvent(response, "error", { error: error.message || "Unable to generate summary", code: error.code || "TYPHOON_ERROR" });
    }
  } finally {
    if (!response.writableEnded) response.end();
  }
});

app.use((error, _request, response, _next) => {
  const status = Number.isInteger(error.status) ? error.status : 500;
  response.status(status).json({ error: error.message || "Internal server error", code: error.code || "INTERNAL_ERROR" });
});

export default app;
