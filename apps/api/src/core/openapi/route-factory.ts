import type { Context } from "hono";
import {
  createRoute,
  type OpenAPIHono,
  type RouteHandler,
} from "@hono/zod-openapi";
import { locationResourceParamSchema } from "@haccp/shared";
import type { z } from "zod";
import type { Db } from "../db/client.js";
import {
  getDb,
  getCurrentLocation,
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
    (async (c: Context<AppEnv>) => {
      const { id: locationId } = getCurrentLocation(c);
      const result = await options.service.list(getDb(c), locationId);
      return c.json(result, 200);
    }) as unknown as RouteHandler<typeof listRoute, AppEnv>,
  );

  options.router.openapi(
    createRouteDef,
    (async (c: Context<AppEnv>) => {
      const { id: locationId } = getCurrentLocation(c);
      const input = options.schemas.create.parse(await c.req.json());
      const created = await options.service.create(getDb(c), locationId, input);
      return c.json(created, 201);
    }) as unknown as RouteHandler<typeof createRouteDef, AppEnv>,
  );

  options.router.openapi(
    updateRouteDef,
    (async (c: Context<AppEnv>) => {
      const { id: locationId } = getCurrentLocation(c);
      const { id } = locationResourceParamSchema.parse(c.req.param());
      const input = options.schemas.update.parse(await c.req.json());
      const updated = await options.service.update(
        getDb(c),
        locationId,
        id,
        input,
      );
      return c.json(updated, 200);
    }) as unknown as RouteHandler<typeof updateRouteDef, AppEnv>,
  );

  options.router.openapi(
    deleteRouteDef,
    (async (c: Context<AppEnv>) => {
      const { id: locationId } = getCurrentLocation(c);
      const { id } = locationResourceParamSchema.parse(c.req.param());
      await options.service.delete(getDb(c), locationId, id);
      return c.body(null, 204);
    }) as unknown as RouteHandler<typeof deleteRouteDef, AppEnv>,
  );
}
