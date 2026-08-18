import { describe, expect, it } from "vitest";
import { apiRequest } from "./harness/request.js";
import { failRedisCommands, hangRedisCommands } from "./harness/redis.js";

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

  it("degrades promptly rather than hanging when a Redis command never resolves", async () => {
    const restore = await hangRedisCommands("ping");

    try {
      const start = Date.now();
      const response = await apiRequest("/health");
      const elapsedMs = Date.now() - start;

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        database: "connected",
        redis: "disconnected",
      });

      // Bounded by COMMAND_TIMEOUT_MS, not the suite's 20s test timeout.
      expect(elapsedMs).toBeLessThan(5000);
    } finally {
      restore();
    }
  });
});
