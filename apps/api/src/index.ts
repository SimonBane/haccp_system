import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { closeDb } from "./db/index.js";
import { env } from "./env.js";
import { logger } from "./lib/logger.js";

const server = serve(
  {
    fetch: app.fetch,
    port: env.API_PORT,
  },
  (info) => {
    logger.info(`HACCP API listening on http://localhost:${info.port}`);
  },
);

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down");

  await closeDb();

  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
