import { AppError, ConflictError } from "../core/errors/app-errors.js";

export function isPostgresError(error: unknown, code: string): boolean {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  ) {
    return true;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "cause" in error &&
    isPostgresError((error as { cause: unknown }).cause, code)
  ) {
    return true;
  }

  return false;
}

export function isUniqueViolation(error: unknown): boolean {
  return isPostgresError(error, "23505");
}

export function isForeignKeyViolation(error: unknown): boolean {
  return isPostgresError(error, "23503");
}

// A lost insert race, from either side of the boundary: the raw driver error, or
// a ConflictError some helper already translated it into. Callers that recover by
// re-reading must check this rather than isUniqueViolation alone.
export function isContention(error: unknown): boolean {
  return isUniqueViolation(error) || error instanceof ConflictError;
}

// Do not call this inside a helper whose caller may need to detect contention —
// translating 23505 into an AppError hides the race from the recovery path.
export function mapDbMutationError(
  error: unknown,
  mapping: {
    unique?: () => AppError;
    foreignKey?: () => AppError;
  },
): never {
  if (mapping.unique && isUniqueViolation(error)) {
    throw mapping.unique();
  }

  if (mapping.foreignKey && isForeignKeyViolation(error)) {
    throw mapping.foreignKey();
  }

  throw error;
}
