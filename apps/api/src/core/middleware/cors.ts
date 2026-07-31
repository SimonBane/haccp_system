import { cors } from "hono/cors";
import { env } from "../../env.js";

function isAllowedOrigin(origin: string): boolean {
  if (env.corsOrigins.includes(origin)) {
    return true;
  }

  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

export const corsMiddleware = cors({
  origin: (origin) => (origin && isAllowedOrigin(origin) ? origin : null),
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  exposeHeaders: ["X-Request-Id"],
});
