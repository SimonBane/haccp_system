import { randomUUID } from "node:crypto";
import { Webhook } from "standardwebhooks";
import { TEST_CLERK_WEBHOOK_SIGNING_SECRET } from "./test-env.js";

/**
 * Signs a Clerk-shaped webhook payload the same way Clerk actually does (Svix /
 * the Standard Webhooks spec), so `/webhooks` sees real, verifiable requests —
 * `verifyWebhook` is not mocked, unlike the rest of the Clerk network boundary.
 */
export function signWebhookRequest(payload: {
  type: string;
  data: Record<string, unknown>;
}): { body: string; headers: Record<string, string> } {
  const webhook = new Webhook(TEST_CLERK_WEBHOOK_SIGNING_SECRET);
  const body = JSON.stringify({ ...payload, object: "event" });
  const id = `msg_${randomUUID()}`;
  const timestamp = new Date();
  const signature = webhook.sign(id, timestamp, body);

  return {
    body,
    headers: {
      "svix-id": id,
      "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "svix-signature": signature,
    },
  };
}
