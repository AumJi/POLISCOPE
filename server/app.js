import express from "express";

const app = express();

app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "poliscope-api",
    environment: {
      database: Boolean(process.env.DATABASE_URL),
      newsApi: Boolean(process.env.NEWS_API_KEY),
      typhoonApi: Boolean(process.env.TYPHOON_API_KEY),
    },
  });
});

export default app;
