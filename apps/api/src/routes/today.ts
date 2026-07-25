import type {
  CompleteTodayTaskInput,
  CompleteTodayTemperatureTaskInput,
} from "@haccp/shared";
import {
  completeTodayTemperatureTaskSchema,
  completeTodayTaskSchema,
  todayDateQuerySchema,
  todayResponseSchema,
  todayTaskItemSchema,
} from "@haccp/shared";
import { OpenAPIHono } from "@hono/zod-openapi";
import { zValidator } from "@hono/zod-validator";
import { db } from "../db/index.js";
import { todayService } from "../services/today.service.js";
import type { AppEnv } from "../types.js";

export const todayRoutes = new OpenAPIHono<AppEnv>();

todayRoutes.get(
  "/",
  zValidator("query", todayDateQuerySchema),
  async (c) => {
    const orgId = c.get("orgId")!;
    const { date } = c.req.valid("query");
    const result = await todayService.getToday(db, orgId, date);
    return c.json(todayResponseSchema.parse(result), 200);
  },
);

todayRoutes.post(
  "/complete",
  zValidator("json", completeTodayTaskSchema),
  async (c) => {
    const orgId = c.get("orgId")!;
    const userId = c.get("userId")!;
    const input = c.req.valid("json") as CompleteTodayTaskInput;
    const result = await todayService.completeTask(db, orgId, userId, input);
    return c.json(todayTaskItemSchema.parse(result), 200);
  },
);

todayRoutes.post(
  "/complete-temperature",
  zValidator("json", completeTodayTemperatureTaskSchema),
  async (c) => {
    const orgId = c.get("orgId")!;
    const userId = c.get("userId")!;
    const input = c.req.valid("json") as CompleteTodayTemperatureTaskInput;
    const result = await todayService.completeTemperatureTask(
      db,
      orgId,
      userId,
      input,
    );
    return c.json(todayTaskItemSchema.parse(result), 200);
  },
);

todayRoutes.delete(
  "/complete",
  zValidator("json", completeTodayTaskSchema),
  async (c) => {
    const orgId = c.get("orgId")!;
    const input = c.req.valid("json") as CompleteTodayTaskInput;
    const result = await todayService.uncompleteTask(db, orgId, input);
    return c.json(todayTaskItemSchema.parse(result), 200);
  },
);
