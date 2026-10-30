import express from "express";
import { isDatabaseConfigured } from "./db/pool.js";

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

export default app;
