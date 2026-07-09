import type { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../types.js";
import { openApiDocument } from "./document.js";

export async function registerDevDocs(
  app: OpenAPIHono<AppEnv>,
): Promise<void> {
  const { swaggerUI } = await import("@hono/swagger-ui");

  app.doc("/doc", openApiDocument);
  app.get("/", swaggerUI({ url: "/doc" }));
}
