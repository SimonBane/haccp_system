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

// Lost insert race: raw 23505 or a ConflictError a helper already translated. Recovery must check this, not isUniqueViolation alone.
export function isContention(error: unknown): boolean {
  return isUniqueViolation(error) || error instanceof ConflictError;
}

// Do not translate 23505 inside a helper whose caller recovers from contention — that hides the race.
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
