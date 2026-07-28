import { verifyWebhook } from "@clerk/backend/webhooks";
import { Hono } from "hono";
import { env } from "../../env.js";
import { getDb } from "../../lib/context.js";
import { logger } from "../../lib/logger.js";
import type { AppEnv } from "../../types.js";
import { clerkWebhookService } from "./clerk-webhook.service.js";

export const clerkWebhookRoutes = new Hono<AppEnv>();

clerkWebhookRoutes.post("/clerk", async (c) => {
  let event;

  try {
    event = await verifyWebhook(c.req.raw, {
      signingSecret: env.CLERK_WEBHOOK_SIGNING_SECRET,
    });
  } catch (error) {
    logger.warn(
      { err: error },
      "Clerk webhook verification failed — check CLERK_WEBHOOK_SIGNING_SECRET matches the Clerk Dashboard endpoint (note: .env.local overrides .env)",
    );
    return c.text("Webhook verification failed", 400);
  }

  const db = getDb(c);

  switch (event.type) {
    case "organization.created": {
      const { id, name } = event.data;
      await clerkWebhookService.handleOrganizationCreated(
        db,
        id,
        name ?? "Organization",
      );
      break;
    }
    case "organization.updated": {
      const { id, name } = event.data;
      await clerkWebhookService.handleOrganizationUpdated(
        db,
        id,
        name ?? "Organization",
      );
      break;
    }
    case "organization.deleted": {
      const id = event.data.id;
      if (id) {
        await clerkWebhookService.handleOrganizationDeleted(db, id);
      }
      break;
    }
    default:
      break;
  }

  return c.text("OK", 200);
});
