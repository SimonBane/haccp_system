import { app } from "../../../src/app.js";
import { encodeTestToken } from "./clerk-fake.js";
import type { SeededOrg } from "./fixtures.js";

export type Actor = {
  clerkUserId: string;
  clerkOrgId: string | null;
  orgRole: string | null;
  /** Unix seconds. Omit for "never expires" — most tests don't care about expiry. */
  exp?: number;
  iat?: number;
};

export type RequestOptions = Omit<RequestInit, "headers"> & {
  actor?: Actor;
  headers?: Record<string, string>;
  /** Sent verbatim, bypassing `actor` — for malformed-token cases. */
  rawToken?: string;
};

/**
 * Runs the real app in-process through the whole middleware chain. Import `app`,
 * never `src/index.ts`, which binds a port.
 */
export async function apiRequest(
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  const { actor, headers, rawToken, ...init } = options;

  const token =
    rawToken ??
    (actor
      ? encodeTestToken({
          sub: actor.clerkUserId,
          org_id: actor.clerkOrgId,
          org_role: actor.orgRole,
          exp: actor.exp,
          iat: actor.iat,
        })
      : null);

  return app.request(path, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "content-type": "application/json",
      ...headers,
    },
  });
}

/**
 * Role travels on the token, not the database row — `requireOrgAdmin` reads the
 * raw `org_role` claim, so the two can be set independently.
 */
export function asAdmin(org: SeededOrg): Actor {
  return {
    clerkUserId: org.admin.clerkUserId,
    clerkOrgId: org.clerkOrgId,
    orgRole: "org:admin",
  };
}

export function asEmployee(org: SeededOrg): Actor {
  return {
    clerkUserId: org.employee.clerkUserId,
    clerkOrgId: org.clerkOrgId,
    orgRole: "org:employee",
  };
}
