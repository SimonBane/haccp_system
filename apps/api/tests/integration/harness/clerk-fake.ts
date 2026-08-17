import {
  ClerkAPIResponseError,
  TokenVerificationError,
  TokenVerificationErrorReason,
} from "@clerk/backend/errors";
import { vi } from "vitest";

/**
 * The Clerk network boundary, and nothing else. Errors come from the real
 * `@clerk/backend/errors`: the API classifies by instanceof, so look-alike errors
 * would let the 401-vs-503 split pass while being wrong.
 */

export type ClerkFailureMode =
  /** Resolve from the registry below. */
  | "success"
  /** Never settles. `withClerkTimeout` rejects at 5s → 503. */
  | "timeout"
  /** Clerk 5xx → 503. Upstream is unwell; the caller may retry. */
  | "retryable"
  /** Clerk 404 → 403. The caller is not entitled; retrying will not help. */
  | "permanent"
  /** Our secret key was rejected → 503, never 401. */
  | "invalid-secret"
  /** The presented token is bad → 401. */
  | "bad-token"
  /** Transport failure below Clerk → 503. */
  | "network";

export type ClerkTarget =
  | "verifyToken"
  | "users.getUser"
  | "organizations.getOrganization"
  | "organizations.updateOrganizationMembership"
  | "*";

export type FakeClerkUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  emailAddresses: Array<{ id: string; emailAddress: string }>;
  primaryEmailAddressId: string | null;
  imageUrl: string;
  hasImage: boolean;
};

export type FakeClerkOrganization = {
  id: string;
  name: string;
  imageUrl: string;
  hasImage: boolean;
};

export type FakeTokenClaims = {
  sub: string;
  org_id: string | null;
  org_role: string | null;
};

const TOKEN_PREFIX = "test.";

/** Mints the bearer a test presents. Not a JWT — the fake below decodes it. */
export function encodeTestToken(claims: FakeTokenClaims): string {
  return (
    TOKEN_PREFIX + Buffer.from(JSON.stringify(claims)).toString("base64url")
  );
}

function decodeTestToken(token: string): FakeTokenClaims {
  if (!token.startsWith(TOKEN_PREFIX)) {
    // A non-JWT fails inside the real verifyToken as a bare SyntaxError, which
    // isInvalidTokenError treats as a bad token (401).
    throw new SyntaxError("Unexpected token in JSON");
  }

  return JSON.parse(
    Buffer.from(token.slice(TOKEN_PREFIX.length), "base64url").toString("utf8"),
  ) as FakeTokenClaims;
}

function clerkApiError(status: number, message: string): ClerkAPIResponseError {
  return new ClerkAPIResponseError(message, {
    status,
    data: [],
  });
}

function never(): Promise<never> {
  return new Promise(() => {});
}

const modes = new Map<ClerkTarget, ClerkFailureMode>();
const users = new Map<string, FakeClerkUser>();
const organizations = new Map<string, FakeClerkOrganization>();
const calls = new Map<ClerkTarget, number>();
/** When set, overrides the role returned by updateOrganizationMembership — proves callers read Clerk's response rather than assuming success mirrors the request. */
let nextMembershipRole: string | null = null;

function record(target: ClerkTarget): void {
  calls.set(target, (calls.get(target) ?? 0) + 1);
}

function modeFor(target: ClerkTarget): ClerkFailureMode {
  return modes.get(target) ?? modes.get("*") ?? "success";
}

/** Returns a promise rather than throwing, so "timeout" can hang the caller. */
function injectedFailure(target: ClerkTarget): Promise<never> | null {
  switch (modeFor(target)) {
    case "success":
      return null;
    case "timeout":
      return never();
    case "retryable":
      return Promise.reject(clerkApiError(500, "Clerk is unavailable"));
    case "permanent":
      return Promise.reject(clerkApiError(404, "Not Found"));
    case "invalid-secret":
      return Promise.reject(
        new TokenVerificationError({
          message: "Secret key is invalid",
          reason: TokenVerificationErrorReason.InvalidSecretKey,
        }),
      );
    case "bad-token":
      return Promise.reject(
        new TokenVerificationError({
          message: "Token has expired",
          reason: TokenVerificationErrorReason.TokenExpired,
        }),
      );
    case "network":
      return Promise.reject(new TypeError("fetch failed"));
  }
}

const verifyToken = vi.fn(async (token: string): Promise<FakeTokenClaims> => {
  record("verifyToken");

  const failure = injectedFailure("verifyToken");
  if (failure) {
    return failure;
  }

  return decodeTestToken(token);
});

const getUser = vi.fn(async (clerkUserId: string): Promise<FakeClerkUser> => {
  record("users.getUser");

  const failure = injectedFailure("users.getUser");
  if (failure) {
    return failure;
  }

  const user = users.get(clerkUserId);
  if (!user) {
    throw clerkApiError(404, `User ${clerkUserId} not found`);
  }

  return user;
});

const getOrganization = vi.fn(
  async ({
    organizationId,
  }: {
    organizationId: string;
  }): Promise<FakeClerkOrganization> => {
    record("organizations.getOrganization");

    const failure = injectedFailure("organizations.getOrganization");
    if (failure) {
      return failure;
    }

    const organization = organizations.get(organizationId);
    if (!organization) {
      throw clerkApiError(404, `Organization ${organizationId} not found`);
    }

    return organization;
  },
);

const updateOrganizationMembership = vi.fn(
  async ({ role }: { organizationId: string; userId: string; role: string }) => {
    record("organizations.updateOrganizationMembership");

    const failure = injectedFailure("organizations.updateOrganizationMembership");
    if (failure) {
      return failure;
    }

    return { id: "orgmem_test", role: nextMembershipRole ?? role };
  },
);

/** Mirrors the surface `clerkClient` is called through; writes resolve inertly. */
const client = {
  users: {
    getUser,
    updateUser: vi.fn(async (id: string) => users.get(id) ?? null),
  },
  organizations: {
    getOrganization,
    updateOrganization: vi.fn(async () => null),
    updateOrganizationLogo: vi.fn(async () => null),
    deleteOrganizationLogo: vi.fn(async () => null),
    getOrganizationMembershipList: vi.fn(async () => ({
      data: [],
      totalCount: 0,
    })),
    createOrganizationInvitation: vi.fn(async () => ({ id: "inv_test" })),
    revokeOrganizationInvitation: vi.fn(async () => ({ id: "inv_test" })),
    deleteOrganizationMembership: vi.fn(async () => null),
    updateOrganizationMembership,
  },
};

export const clerkFake = {
  verifyToken,
  client,

  /** Every test starts from "Clerk is healthy and empty". */
  reset(): void {
    modes.clear();
    users.clear();
    organizations.clear();
    calls.clear();
    nextMembershipRole = null;
    verifyToken.mockClear();
    getUser.mockClear();
    getOrganization.mockClear();
    updateOrganizationMembership.mockClear();
  },

  setMode(target: ClerkTarget, mode: ClerkFailureMode): void {
    modes.set(target, mode);
  },

  /** Makes the next updateOrganizationMembership call return a role different from the one requested. */
  setMembershipRole(role: string): void {
    nextMembershipRole = role;
  },

  /** Pass values disagreeing with the database row to exercise stale metadata. */
  setUser(clerkUserId: string, overrides: Partial<FakeClerkUser> = {}): void {
    const emailId = `idn_${clerkUserId}`;

    users.set(clerkUserId, {
      id: clerkUserId,
      firstName: "Test",
      lastName: "User",
      emailAddresses: [
        { id: emailId, emailAddress: `${clerkUserId}@example.test` },
      ],
      primaryEmailAddressId: emailId,
      imageUrl: "",
      hasImage: false,
      ...overrides,
    });
  },

  setOrganization(
    clerkOrgId: string,
    overrides: Partial<FakeClerkOrganization> = {},
  ): void {
    organizations.set(clerkOrgId, {
      id: clerkOrgId,
      name: "Test Organization",
      imageUrl: "",
      hasImage: false,
      ...overrides,
    });
  },

  /** Proves caching, not just correctness. */
  callCount(target: ClerkTarget): number {
    return calls.get(target) ?? 0;
  },
};
