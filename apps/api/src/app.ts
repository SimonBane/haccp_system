// Required for Vercel Hono entrypoint detection (must import the "hono" package directly).
import "hono";
import { OpenAPIHono } from "@hono/zod-openapi";
import { corsMiddleware } from "./core/middleware/cors.js";
import {
  errorHandler,
  notFoundHandler,
} from "./core/middleware/error-handler.js";
import { requestIdMiddleware } from "./core/middleware/request-id.js";
import { env } from "./env.js";
import { routes } from "./routes/index.js";
import type { AppEnv } from "./types.js";

export const app = new OpenAPIHono<AppEnv>();

app.use("*", requestIdMiddleware);
app.use("*", corsMiddleware);
app.route("/", routes);

if (env.NODE_ENV !== "development") {
  app.get("/", (c) => c.json({ message: "HACCP API" }));
}

app.notFound(notFoundHandler);
app.onError(errorHandler);

export default app;
