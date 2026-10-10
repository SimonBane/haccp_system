import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  createFormSchema,
  createFormVersionSchema,
  formIdParamSchema,
  formListResponseSchema,
  formResponseSchema,
  updateFormSchema,
} from "@haccp/shared";
import {
  bearerSecurity,
  defineRouteHandler,
  errorResponse,
  jsonResponse,
} from "../../core/openapi/responses.js";
import {
  getCurrentOrganization,
  getDb,
  requireOrgContext,
} from "../../lib/context.js";
import type { AppEnv } from "../../types.js";
import { formService } from "./form.service.js";

export const formRoutes = new OpenAPIHono<AppEnv>();

const TAG = "Forms";

const listRoute = createRoute({
  method: "get",
  path: "/",
  tags: [TAG],
  security: bearerSecurity,
  responses: {
    200: jsonResponse(formListResponseSchema),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
  },
});

const getRoute = createRoute({
  method: "get",
  path: "/{formId}",
  tags: [TAG],
  security: bearerSecurity,
  request: { params: formIdParamSchema },
  responses: {
    200: jsonResponse(formResponseSchema),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Not found"),
  },
});

const createRouteDef = createRoute({
  method: "post",
  path: "/",
  tags: [TAG],
  security: bearerSecurity,
  description: "Creates a form with its first version.",
  request: {
    body: { content: { "application/json": { schema: createFormSchema } } },
  },
  responses: {
    201: jsonResponse(formResponseSchema, "Created"),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    409: errorResponse("Conflict"),
  },
});

const updateRouteDef = createRoute({
  method: "patch",
  path: "/{formId}",
  tags: [TAG],
  security: bearerSecurity,
  description:
    "Renames or recategorises a form; its fields change only through a new version.",
  request: {
    params: formIdParamSchema,
    body: { content: { "application/json": { schema: updateFormSchema } } },
  },
  responses: {
    200: jsonResponse(formResponseSchema),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Not found"),
    409: errorResponse("Conflict"),
  },
});

const createVersionRoute = createRoute({
  method: "post",
  path: "/{formId}/versions",
  tags: [TAG],
  security: bearerSecurity,
  description:
    "Publishes a new version. Answers 409 FORM_VERSION_DROPS_OVERRIDES with details.droppedOverrides when it would remove template overrides, until confirmDroppedOverrides is true.",
  request: {
    params: formIdParamSchema,
    body: {
      content: { "application/json": { schema: createFormVersionSchema } },
    },
  },
  responses: {
    201: jsonResponse(formResponseSchema, "Published"),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Not found"),
    409: errorResponse("Conflict"),
  },
});

const deleteRouteDef = createRoute({
  method: "delete",
  path: "/{formId}",
  tags: [TAG],
  security: bearerSecurity,
  description: "Archives the form; refused while active task templates use it.",
  request: { params: formIdParamSchema },
  responses: {
    204: { description: "Archived" },
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Not found"),
    409: errorResponse("Conflict"),
  },
});

formRoutes.openapi(
  listRoute,
  defineRouteHandler(listRoute, async (c) => {
    const { organizationId } = requireOrgContext(c);
    return c.json(await formService.list(getDb(c), organizationId), 200);
  }),
);

formRoutes.openapi(
  getRoute,
  defineRouteHandler(getRoute, async (c) => {
    const { organizationId } = requireOrgContext(c);
    const { formId } = c.req.valid("param");
    return c.json(await formService.get(getDb(c), organizationId, formId), 200);
  }),
);

formRoutes.openapi(
  createRouteDef,
  defineRouteHandler(createRouteDef, async (c) => {
    const { organizationId } = requireOrgContext(c);
    const created = await formService.create(
      getDb(c),
      organizationId,
      c.req.valid("json"),
    );
    return c.json(created, 201);
  }),
);

formRoutes.openapi(
  updateRouteDef,
  defineRouteHandler(updateRouteDef, async (c) => {
    const { organizationId } = requireOrgContext(c);
    const { formId } = c.req.valid("param");
    const updated = await formService.update(
      getDb(c),
      organizationId,
      formId,
      c.req.valid("json"),
    );
    return c.json(updated, 200);
  }),
);

formRoutes.openapi(
  createVersionRoute,
  defineRouteHandler(createVersionRoute, async (c) => {
    const { organizationId } = requireOrgContext(c);
    const { formId } = c.req.valid("param");
    const published = await formService.createVersion(
      getDb(c),
      organizationId,
      getCurrentOrganization(c).timezone,
      formId,
      c.req.valid("json"),
    );
    return c.json(published, 201);
  }),
);

formRoutes.openapi(
  deleteRouteDef,
  defineRouteHandler(deleteRouteDef, async (c) => {
    const { organizationId } = requireOrgContext(c);
    const { formId } = c.req.valid("param");
    await formService.delete(getDb(c), organizationId, formId);
    return c.body(null, 204);
  }),
);
