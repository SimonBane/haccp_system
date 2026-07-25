import { sql } from "drizzle-orm";
import type { Db } from "../../core/db/client.js";
import { getRedis } from "../../core/redis/client.js";
import { logger } from "../../lib/logger.js";

export const healthService = {
  async getHealth(db: Db) {
    await db.execute(sql`SELECT 1`);

    let redis: "connected" | "disconnected" = "disconnected";

    try {
      const client = await getRedis();
      await client.ping();
      redis = "connected";
    } catch (err) {
      logger.warn({ err }, "Redis health check failed");
    }

    return {
      status: "ok" as const,
      service: "haccp-api",
      timestamp: new Date().toISOString(),
      database: "connected" as const,
      redis,
    };
  },
};
