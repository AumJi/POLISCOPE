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
});
