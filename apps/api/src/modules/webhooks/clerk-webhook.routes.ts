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
    case "organizationInvitation.accepted": {
      const data = event.data;
      const clerkOrgId = data.organization_id;
      const clerkUserId = data.user_id;
      const email = data.email_address;
      const role = data.role;
      const invitationId = data.id;

      if (clerkOrgId && clerkUserId && email && role && invitationId) {
        await clerkWebhookService.handleInvitationAccepted(
          db,
          clerkOrgId,
          clerkUserId,
          email,
          role,
          invitationId,
          {
            first_name: null,
            last_name: null,
            email_addresses: [
              {
                id: "primary",
                email_address: email,
              },
            ],
            primary_email_address_id: "primary",
          },
        );
      }
      break;
    }
    case "organizationInvitation.revoked": {
      const invitationId = event.data.id;
      if (invitationId) {
        await clerkWebhookService.handleInvitationRevoked(db, invitationId);
      }
      break;
    }
    default:
      break;
  }

  return c.text("OK", 200);
});
