import { verifyWebhook } from "@clerk/backend/webhooks";
import { Hono } from "hono";
import {
  ForbiddenError,
  NotFoundError,
} from "../../core/errors/app-errors.js";
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

  try {
    await dispatch(db, event);
  } catch (error) {
    // Ack permanent Clerk misses so Svix does not retry them into DLQ.
    if (error instanceof ForbiddenError || error instanceof NotFoundError) {
      logger.warn(
        { err: error, eventType: event.type },
        "Clerk webhook could not be applied and will not be retried",
      );
      return c.text("Acknowledged", 200);
    }

    logger.error(
      { err: error, eventType: event.type },
      "Clerk webhook handler failed",
    );
    throw error;
  }

  return c.text("OK", 200);
});

async function dispatch(
  db: ReturnType<typeof getDb>,
  event: Awaited<ReturnType<typeof verifyWebhook>>,
): Promise<void> {
  switch (event.type) {
    case "organization.created": {
      const { id, name, image_url: imageUrl, has_image: hasImage } = event.data;
      await clerkWebhookService.handleOrganizationCreated(db, id, {
        name: name ?? "Organization",
        imageUrl: imageUrl ?? "",
        hasImage: hasImage ?? false,
      });
      break;
    }
    case "organization.updated": {
      const { id, name, image_url: imageUrl, has_image: hasImage } = event.data;
      await clerkWebhookService.handleOrganizationUpdated(db, id, {
        name: name ?? "Organization",
        imageUrl: imageUrl ?? "",
        hasImage: hasImage ?? false,
      });
      break;
    }
    case "organization.deleted": {
      const id = event.data.id;
      if (id) {
        await clerkWebhookService.handleOrganizationDeleted(db, id);
      }
      break;
    }
    case "user.updated": {
      const id = event.data.id;
      if (id) {
        await clerkWebhookService.handleUserUpdated(db, id, event.data);
      }
      break;
    }
    case "user.deleted": {
      const id = event.data.id;
      if (id) {
        await clerkWebhookService.handleUserDeleted(db, id);
      }
      break;
    }
    case "organizationMembership.deleted": {
      const data = event.data;
      const clerkOrgId = data.organization?.id;
      const clerkUserId = data.public_user_data?.user_id;

      if (clerkOrgId && clerkUserId) {
        await clerkWebhookService.handleMembershipDeleted(
          db,
          clerkOrgId,
          clerkUserId,
        );
      }
      break;
    }
    case "organizationMembership.created": {
      const data = event.data;
      const clerkOrgId = data.organization?.id;
      const clerkUserId = data.public_user_data?.user_id;

      if (clerkOrgId && clerkUserId) {
        await clerkWebhookService.handleMembershipCreated(
          db,
          clerkOrgId,
          clerkUserId,
          data.role,
        );
      }
      break;
    }
    case "organizationMembership.updated": {
      const data = event.data;
      const clerkOrgId = data.organization?.id;
      const clerkUserId = data.public_user_data?.user_id;

      if (clerkOrgId && clerkUserId) {
        await clerkWebhookService.handleMembershipUpdated(
          db,
          clerkOrgId,
          clerkUserId,
        );
      }
      break;
    }
    default:
      break;
  }
}
