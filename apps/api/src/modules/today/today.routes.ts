// @ts-nocheck — Vercel Hono preset per-file TS cannot infer OpenAPI handler types reliably.
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  completeTodayTemperatureTaskSchema,
  completeTodayTaskSchema,
  todayDateQuerySchema,
  todayResponseSchema,
  todayTaskItemSchema,
} from "@haccp/shared";
import {
  errorResponse,
  jsonResponse,
} from "../../core/openapi/route-factory.js";
import { getDb, getCurrentLocation, requireOrgContext } from "../../lib/context.js";
import type { AppEnv } from "../../types.js";
import { todayCompletionService } from "./today-completion.service.js";
import { todayService } from "./today.service.js";

const bearerSecurity = [{ Bearer: [] }];

export const todayRoutes = new OpenAPIHono<AppEnv>();

const getTodayRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Today"],
  security: bearerSecurity,
  request: {
    query: todayDateQuerySchema,
  },
  responses: {
    200: jsonResponse(todayResponseSchema),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
  },
});

const completeTaskRoute = createRoute({
  method: "post",
  path: "/complete",
  tags: ["Today"],
  security: bearerSecurity,
  description:
    "Mark a non-temperature task as complete. Any org member can complete tasks.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: completeTodayTaskSchema,
        },
      },
    },
  },
  responses: {
    200: jsonResponse(todayTaskItemSchema),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Not found"),
  },
});

const completeTemperatureRoute = createRoute({
  method: "post",
  path: "/complete-temperature",
  tags: ["Today"],
  security: bearerSecurity,
  description:
    "Complete a temperature task with a reading. Any org member can complete tasks.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: completeTodayTemperatureTaskSchema,
        },
      },
    },
  },
  responses: {
    200: jsonResponse(todayTaskItemSchema),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Not found"),
  },
});

const uncompleteTaskRoute = createRoute({
  method: "post",
  path: "/uncomplete",
  tags: ["Today"],
  security: bearerSecurity,
  description:
    "Remove a task completion. Any org member can uncomplete tasks.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: completeTodayTaskSchema,
        },
      },
    },
  },
  responses: {
    200: jsonResponse(todayTaskItemSchema),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Not found"),
  },
});

todayRoutes.openapi(getTodayRoute, async (c) => {
  const { date } = c.req.valid("query");
  const { id: locationId } = getCurrentLocation(c);
  const result = await todayService.getToday(getDb(c), locationId, date);
  return c.json(result, 200);
});

todayRoutes.openapi(completeTaskRoute, async (c) => {
  const { userId } = requireOrgContext(c);
  const { id: locationId } = getCurrentLocation(c);
  const input = c.req.valid("json");
  const result = await todayCompletionService.completeTask(
    getDb(c),
    locationId,
    userId,
    input,
  );
  return c.json(result, 200);
});

todayRoutes.openapi(completeTemperatureRoute, async (c) => {
  const { userId } = requireOrgContext(c);
  const { id: locationId } = getCurrentLocation(c);
  const input = c.req.valid("json");
  const result = await todayCompletionService.completeTemperatureTask(
    getDb(c),
    locationId,
    userId,
    input,
  );
  return c.json(result, 200);
});

todayRoutes.openapi(uncompleteTaskRoute, async (c) => {
  const { id: locationId } = getCurrentLocation(c);
  const input = c.req.valid("json");
  const result = await todayCompletionService.uncompleteTask(
    getDb(c),
    locationId,
    input,
  );
  return c.json(result, 200);
});
