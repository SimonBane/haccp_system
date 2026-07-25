import type { AppError } from "../core/errors/app-errors.js";

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
