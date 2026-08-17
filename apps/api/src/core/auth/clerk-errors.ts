import {
  isClerkAPIResponseError,
  TokenVerificationError,
  TokenVerificationErrorReason,
} from "@clerk/backend/errors";
import {
  ForbiddenError,
  RoleUpdateOutcomeUnknownError,
  ServiceUnavailableError,
  ValidationError,
} from "../errors/app-errors.js";
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

/** Reasons that mean the token is bad, not that we could not check. Web treats 401 as signed out. */
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

export function isInvalidTokenError(error: unknown): boolean {
  if (error instanceof TokenVerificationError) {
    return INVALID_TOKEN_REASONS.has(error.reason);
  }

  // "not.a.jwt" fails in JSON.parse as a bare SyntaxError before Clerk classifies it — that is a bad token, not a JWKS failure.
  return error instanceof SyntaxError;
}

export function isClerkMisconfiguration(error: unknown): boolean {
  return (
    error instanceof TokenVerificationError &&
    error.reason === TokenVerificationErrorReason.InvalidSecretKey
  );
}

/** Clerk lookup with timeout. 404 is "not entitled"; everything else is 503 (kept out of Sentry). */
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

    if (error instanceof ServiceUnavailableError) {
      throw error;
    }

    logger.error({ err: error, ...context.logContext }, context.failureLog);
    throw new ServiceUnavailableError(
      "Could not reach the identity provider. Please try again.",
    );
  }
}

function isDefiniteRejection(error: unknown): boolean {
  const status = clerkErrorStatus(error);
  return status !== null && status >= 400 && status < 500;
}

const LAST_ADMIN_CODE = "organization_minimum_permissions_needed";

function isLastAdminRejection(error: unknown): boolean {
  return (
    isClerkAPIResponseError(error) &&
    error.errors.some((entry) => entry.code === LAST_ADMIN_CODE)
  );
}

export async function callClerkWrite<T>(
  promise: Promise<T>,
  context: {
    rejectionMessage: string;
    logContext: Record<string, unknown>;
  },
): Promise<T> {
  try {
    return await withClerkTimeout(promise);
  } catch (error) {
    if (isDefiniteRejection(error)) {
      if (isLastAdminRejection(error)) {
        throw new ValidationError(
          "The organization must keep at least one admin.",
        );
      }

      throw new ValidationError(context.rejectionMessage);
    }

    logger.error(
      { err: error, ...context.logContext },
      "Clerk write outcome could not be determined",
    );
    throw new RoleUpdateOutcomeUnknownError();
  }
}
