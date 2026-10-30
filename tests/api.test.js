import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../server/app.js";

describe("HTTP API validation", () => {
  it("reports configured services without exposing values", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "ok", service: "poliscope-api" });
    expect(response.body).not.toHaveProperty("databaseUrl");
    expect(response.body).not.toHaveProperty("newsApiKey");
    expect(response.body).not.toHaveProperty("typhoonApiKey");
  });

  it("rejects invalid summarize requests before database access", async () => {
    const response = await request(app)
      .post("/api/summarize")
      .send({ articleId: "not-a-uuid" });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("valid UUID");
  });

  it("returns an explicit service error when news needs an unconfigured database", async () => {
    const response = await request(app).get("/api/news");

    expect(response.status).toBe(503);
    expect(response.body.error).toBe("Database is not configured");
  });

  it("validates article detail identifiers", async () => {
    const response = await request(app).get("/api/news/not-a-uuid");

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("valid UUID");
  });

  it("keeps article detail server-only when the database is unavailable", async () => {
    const response = await request(app).get("/api/news/550e8400-e29b-41d4-a716-446655440000");

    expect(response.status).toBe(503);
    expect(response.body.error).toBe("Database is not configured");
  });

  it("rejects unauthorized scheduled ingestion", async () => {
    const previousSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-cron-secret";
    const response = await request(app).get("/api/cron/ingest").set("Authorization", "Bearer wrong-secret");
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Unauthorized");
  });

  it("returns an explicit service error when analytics needs an unconfigured database", async () => {
    const response = await request(app).get("/api/analytics/overview?range=30d");

    expect(response.status).toBe(503);
    expect(response.body.error).toBe("Database is not configured");
  });

  it("returns an explicit service error when topic analytics needs an unconfigured database", async () => {
    const response = await request(app).get("/api/analytics/topics?range=7d");

    expect(response.status).toBe(503);
    expect(response.body.error).toBe("Database is not configured");
  });
});
