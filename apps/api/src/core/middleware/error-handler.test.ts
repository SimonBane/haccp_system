import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { API_ERROR_CODE, apiErrorSchema } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import {
  ConflictError,
  InternalError,
  ValidationError,
} from "../errors/app-errors.js";
import type { AppEnv } from "../../types.js";
import {
  errorHandler,
  notFoundHandler,
  validationHook,
} from "./error-handler.js";
import { requestIdMiddleware } from "./request-id.js";

function testApp() {
  const app = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });
  app.use("*", requestIdMiddleware);
  app.onError(errorHandler);
  app.notFound(notFoundHandler);
  return app;
}

async function errorBody(response: Response) {
  const body = apiErrorSchema.parse(await response.json());
  expect(body.requestId).toBe(response.headers.get("X-Request-Id"));
  return body;
}

describe("errorHandler", () => {
  it("returns safe 4xx messages and stable actionable codes", async () => {
    const app = testApp();
    app.get("/conflict", () => {
      throw new ConflictError("A location with this name already exists", {
        code: API_ERROR_CODE.LOCATION_NAME_EXISTS,
      });
    });

    const response = await app.request("/conflict");
    const body = await errorBody(response);

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      error: API_ERROR_CODE.LOCATION_NAME_EXISTS,
      message: "A location with this name already exists",
    });
  });

  it("sanitizes explicit internal errors", async () => {
    const app = testApp();
    app.get("/internal", () => {
      throw new InternalError("Failed to create temperature detail");
    });

    const response = await app.request("/internal");
    const body = await errorBody(response);

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      error: API_ERROR_CODE.INTERNAL,
      message: "An unexpected error occurred",
    });
    expect(JSON.stringify(body)).not.toContain("temperature detail");
  });

  it("sanitizes unknown exceptions", async () => {
    const app = testApp();
    app.get("/unknown", () => {
      throw new Error("database connection secret");
    });

    const response = await app.request("/unknown");
    const body = await errorBody(response);

    expect(response.status).toBe(500);
    expect(body.message).toBe("An unexpected error occurred");
    expect(JSON.stringify(body)).not.toContain("database connection secret");
  });

  it("formats thrown Zod errors", async () => {
    const app = testApp();
    app.get("/zod", () => {
      z.object({ name: z.string() }).parse({});
      return new Response(null, { status: 204 });
    });

    const response = await app.request("/zod");
    const body = await errorBody(response);

    expect(response.status).toBe(400);
    expect(body.error).toBe(API_ERROR_CODE.VALIDATION);
    expect(body.details).toBeDefined();
  });

  it("formats OpenAPI request validation failures", async () => {
    const app = testApp();
    const route = createRoute({
      method: "post",
      path: "/validated",
      request: {
        body: {
          required: true,
          content: {
            "application/json": {
              schema: z.object({ name: z.string().min(1) }),
            },
          },
        },
      },
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": { schema: z.object({ ok: z.boolean() }) },
          },
        },
        400: {
          description: "Validation error",
          content: { "application/json": { schema: apiErrorSchema } },
        },
      },
    });
    app.openapi(route, (c) => c.json({ ok: true }, 200));

    const response = await app.request("/validated", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });
    const body = await errorBody(response);

    expect(response.status).toBe(400);
    expect(body.error).toBe(API_ERROR_CODE.VALIDATION);
    expect(body.details).toBeDefined();
    expect(body).not.toHaveProperty("success");
  });

  it("formats route misses", async () => {
    const response = await testApp().request("/missing");
    const body = await errorBody(response);

    expect(response.status).toBe(404);
    expect(body.error).toBe(API_ERROR_CODE.NOT_FOUND);
  });

  it("does not serialize arbitrary details on business errors unless supplied", async () => {
    const app = testApp();
    app.get("/validation", () => {
      throw new ValidationError("Invalid business state");
    });

    const body = await errorBody(await app.request("/validation"));
    expect(body).not.toHaveProperty("details");
  });
});
