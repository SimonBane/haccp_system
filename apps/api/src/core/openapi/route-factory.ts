import {
  createRoute,
  type OpenAPIHono,
} from "@hono/zod-openapi";
import { locationResourceParamSchema } from "@haccp/shared";
import type { z } from "zod";
import type { Db } from "../db/client.js";
import {
  getDb,
  getCurrentLocation,
} from "../../lib/context.js";
import type { AppEnv } from "../../types.js";
import { errorResponse, jsonResponse, defineRouteHandler, bearerSecurity } from "./responses.js";

export { errorResponse, jsonResponse, defineRouteHandler } from "./responses.js";

/** Names the already-validated body/params; do not re-parse (Zod v4 handler cast). */
function validated<T>(
  c: { req: { valid: (target: never) => unknown } },
  target: "json" | "param",
): T {
  return c.req.valid(target as never) as T;
}

type AdminCrudService<
  TCreate extends z.ZodType,
  TUpdate extends z.ZodType,
  TList extends z.ZodType,
  TItem extends z.ZodType,
> = {
  list: (db: Db, locationId: string) => Promise<z.output<TList>>;
  create: (
    db: Db,
    locationId: string,
    input: z.output<TCreate>,
  ) => Promise<z.output<TItem>>;
  update: (
    db: Db,
    locationId: string,
    id: string,
    input: z.output<TUpdate>,
  ) => Promise<z.output<TItem>>;
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
      params: locationResourceParamSchema,
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
      params: locationResourceParamSchema,
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
    defineRouteHandler(listRoute, async (c) => {
      const { id: locationId } = getCurrentLocation(c);
      const result = await options.service.list(getDb(c), locationId);
      return c.json(result, 200);
    }),
  );

  options.router.openapi(
    createRouteDef,
    defineRouteHandler(createRouteDef, async (c) => {
      const { id: locationId } = getCurrentLocation(c);
      const input = validated<z.output<TCreate>>(c, "json");
      const created = await options.service.create(getDb(c), locationId, input);
      return c.json(created, 201);
    }),
  );

  options.router.openapi(
    updateRouteDef,
    defineRouteHandler(updateRouteDef, async (c) => {
      const { id: locationId } = getCurrentLocation(c);
      const { id } = validated<{ id: string }>(c, "param");
      const input = validated<z.output<TUpdate>>(c, "json");
      const updated = await options.service.update(
        getDb(c),
        locationId,
        id,
        input,
      );
      return c.json(updated, 200);
    }),
  );

  options.router.openapi(
    deleteRouteDef,
    defineRouteHandler(deleteRouteDef, async (c) => {
      const { id: locationId } = getCurrentLocation(c);
      const { id } = validated<{ id: string }>(c, "param");
      await options.service.delete(getDb(c), locationId, id);
      return c.body(null, 204);
    }),
  );
}
