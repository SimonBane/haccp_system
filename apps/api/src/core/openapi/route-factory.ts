// @ts-nocheck — generic OpenAPI route registration does not infer handler types reliably.
import {
  createRoute,
  type OpenAPIHono,
} from "@hono/zod-openapi";
import { uuidParamSchema } from "@haccp/shared";
import type { z } from "zod";
import type { Db } from "../db/client.js";
import {
  getDb,
  getCurrentLocation,
  requireOrgContext,
} from "../../lib/context.js";
import type { AppEnv } from "../../types.js";
import { errorResponse, jsonResponse } from "./responses.js";

export { errorResponse, jsonResponse } from "./responses.js";

const bearerSecurity = [{ Bearer: [] }];

type AdminCrudService<
  TCreate extends z.ZodType,
  TUpdate extends z.ZodType,
  TList extends z.ZodType,
  TItem extends z.ZodType,
> = {
  list: (db: Db, locationId: string) => Promise<z.infer<TList>>;
  create: (
    db: Db,
    organizationId: string,
    input: z.infer<TCreate>,
  ) => Promise<z.infer<TItem>>;
  update: (
    db: Db,
    locationId: string,
    id: string,
    input: z.infer<TUpdate>,
  ) => Promise<z.infer<TItem>>;
  delete: (db: Db, locationId: string, id: string) => Promise<void>;
};

export function registerAdminCrudRoutes<
  TCreate extends z.ZodType,
  TUpdate extends z.ZodType,
  TList extends z.ZodType,
  TItem extends z.ZodType,
>(options: {
  router: OpenAPIHono<AppEnv>;
  tag: string;
  schemas: {
    create: TCreate;
    update: TUpdate;
    list: TList;
    item: TItem;
  };
  service: AdminCrudService<TCreate, TUpdate, TList, TItem>;
}) {
  const listRoute = createRoute({
    method: "get",
    path: "/",
    tags: [options.tag],
    security: bearerSecurity,
    responses: {
      200: jsonResponse(options.schemas.list),
      401: errorResponse("Unauthorized"),
      403: errorResponse("Forbidden"),
    },
  });

  const createRouteDef = createRoute({
    method: "post",
    path: "/",
    tags: [options.tag],
    security: bearerSecurity,
    request: {
      body: {
        content: {
          "application/json": {
            schema: options.schemas.create,
          },
        },
      },
    },
    responses: {
      201: jsonResponse(options.schemas.item, "Created"),
      400: errorResponse("Validation error"),
      401: errorResponse("Unauthorized"),
      403: errorResponse("Forbidden"),
      409: errorResponse("Conflict"),
    },
  });

  const updateRouteDef = createRoute({
    method: "patch",
    path: "/{id}",
    tags: [options.tag],
    security: bearerSecurity,
    request: {
      params: uuidParamSchema,
      body: {
        content: {
          "application/json": {
            schema: options.schemas.update,
          },
        },
      },
    },
    responses: {
      200: jsonResponse(options.schemas.item),
      400: errorResponse("Validation error"),
      401: errorResponse("Unauthorized"),
      403: errorResponse("Forbidden"),
      404: errorResponse("Not found"),
      409: errorResponse("Conflict"),
    },
  });

  const deleteRouteDef = createRoute({
    method: "delete",
    path: "/{id}",
    tags: [options.tag],
    security: bearerSecurity,
    request: {
      params: uuidParamSchema,
    },
    responses: {
      204: { description: "Deleted" },
      401: errorResponse("Unauthorized"),
      403: errorResponse("Forbidden"),
      404: errorResponse("Not found"),
    },
  });

  options.router.openapi(
    listRoute,
    async (c) => {
      const { id: locationId } = getCurrentLocation(c);
      const result = await options.service.list(getDb(c), locationId);
      return c.json(result, 200);
    },
  );

  options.router.openapi(
    createRouteDef,
    async (c) => {
      const { organizationId } = requireOrgContext(c);
      const input = c.req.valid("json");
      const created = await options.service.create(
        getDb(c),
        organizationId,
        input,
      );
      return c.json(created, 201);
    },
  );

  options.router.openapi(
    updateRouteDef,
    async (c) => {
      const { id: locationId } = getCurrentLocation(c);
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const updated = await options.service.update(
        getDb(c),
        locationId,
        id,
        input,
      );
      return c.json(updated, 200);
    },
  );

  options.router.openapi(
    deleteRouteDef,
    async (c) => {
      const { id: locationId } = getCurrentLocation(c);
      const { id } = c.req.valid("param");
      await options.service.delete(getDb(c), locationId, id);
      return c.body(null, 204);
    },
  );
}
