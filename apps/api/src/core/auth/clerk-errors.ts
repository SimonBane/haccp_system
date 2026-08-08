import {
  isClerkAPIResponseError,
  TokenVerificationError,
  TokenVerificationErrorReason,
} from "@clerk/backend/errors";
import { ForbiddenError, ServiceUnavailableError } from "../errors/app-errors.js";
import { logger } from "../../lib/logger.js";

const CLERK_TIMEOUT_MS = 5000;

export function clerkErrorStatus(error: unknown): number | null {
  return isClerkAPIResponseError(error) ? error.status : null;
}

// @clerk/backend sets no fetch timeout, so a hung connection would hang the request.
export async function withClerkTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new ServiceUnavailableError("Identity provider timed out")),
      CLERK_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The reasons that genuinely mean "this token is no good" — as opposed to "we
 * could not check". Everything else `verifyToken` can throw is a JWKS fetch
 * failure, a bad secret key, or an unclassified verification error: our problem
 * or Clerk's, not the caller's.
 *
 * The distinction is load-bearing. The web app treats 401 as "signed out", so
 * reporting one for a Clerk outage signs every kitchen tablet out at once.
 */
const INVALID_TOKEN_REASONS = new Set<string>([
  TokenVerificationErrorReason.TokenExpired,
  TokenVerificationErrorReason.TokenInvalid,
  TokenVerificationErrorReason.TokenInvalidAlgorithm,
  TokenVerificationErrorReason.TokenInvalidAuthorizedParties,
  TokenVerificationErrorReason.TokenInvalidSignature,
  TokenVerificationErrorReason.TokenNotActiveYet,
  TokenVerificationErrorReason.TokenIatInTheFuture,
  TokenVerificationErrorReason.JWKKidMismatch,
]);

/** True when the failure is the caller's token rather than an upstream problem. */
export function isInvalidTokenError(error: unknown): boolean {
  if (error instanceof TokenVerificationError) {
    return INVALID_TOKEN_REASONS.has(error.reason);
  }

  // A token shaped like a JWT but carrying segments that are not valid JSON —
  // "not.a.jwt" — fails in JSON.parse before Clerk classifies anything, so it
  // surfaces as a bare SyntaxError. That is unambiguously a bad token, and it
  // happens before any network call: Clerk wraps its own JWKS parse failures as
  // TokenVerificationError with a RemoteJWK* reason, which is handled above.
  return error instanceof SyntaxError;
}

/** True when we could not verify because our own Clerk credentials are wrong. */
export function isClerkMisconfiguration(error: unknown): boolean {
  return (
    error instanceof TokenVerificationError &&
    error.reason === TokenVerificationErrorReason.InvalidSecretKey
  );
}

/**
 * Runs a Clerk lookup with a timeout and the one error policy this service uses.
 *
 * A 404 is authoritative: Clerk cannot mint a token scoped to a resource it does
 * not have, so a miss means "not entitled", not "we are behind". Everything else
 * is an upstream problem and surfaces as 503 — which the error handler
 * deliberately keeps out of Sentry, since it is not our bug.
 */
export async function callClerk<T>(
  promise: Promise<T>,
  context: {
    notFoundMessage: string;
    notFoundLog: string;
    failureLog: string;
    logContext: Record<string, unknown>;
  },
): Promise<T> {
  try {
    return await withClerkTimeout(promise);
  } catch (error) {
    if (clerkErrorStatus(error) === 404) {
      logger.warn(context.logContext, context.notFoundLog);
      throw new ForbiddenError(context.notFoundMessage);
    }

    // Already classified by withClerkTimeout; do not re-wrap.
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }

    logger.error({ err: error, ...context.logContext }, context.failureLog);
    throw new ServiceUnavailableError(
      "Could not reach the identity provider. Please try again.",
    );
  }
}
