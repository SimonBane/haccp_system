import { Hono } from "hono";
import { healthResponseSchema } from "@haccp/shared";

export const healthRoutes = new Hono();

healthRoutes.get("/", () => {
  const payload = {
    status: "ok" as const,
    service: "haccp-api",
    timestamp: new Date().toISOString(),
  };

  return Response.json(healthResponseSchema.parse(payload));
});
