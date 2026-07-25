import { sql } from "drizzle-orm";
import type { Db } from "../../core/db/client.js";

export const healthService = {
  async getHealth(db: Db) {
    await db.execute(sql`SELECT 1`);

    return {
      status: "ok" as const,
      service: "haccp-api",
      timestamp: new Date().toISOString(),
      database: "connected" as const,
    };
  },
};
