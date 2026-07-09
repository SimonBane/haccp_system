import { cors } from "hono/cors";
import { env } from "../env.js";

export const corsMiddleware = cors({
  origin: env.CORS_ORIGIN,
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  exposeHeaders: ["X-Request-Id"],
});
