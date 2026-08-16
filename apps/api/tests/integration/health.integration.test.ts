import { describe, expect, it } from "vitest";
import { apiRequest } from "./harness/request.js";
import { failRedisCommands } from "./harness/redis.js";

/** The only route touching Postgres and Redis and nothing else, so it also proves the harness is wired. */
describe("GET /health", () => {
  it("reports both dependencies connected", async () => {
    const response = await apiRequest("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      database: "connected",
      redis: "connected",
    });
  });

  it("degrades rather than failing when Redis is unreachable", async () => {
    const restore = await failRedisCommands("ping");

    try {
      const response = await apiRequest("/health");

      // Redis is optional: a failure downgrades the report, where a database failure is a 500.
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        database: "connected",
        redis: "disconnected",
      });
    } finally {
      restore();
    }
  });
});
