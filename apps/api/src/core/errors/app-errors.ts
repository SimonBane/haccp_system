import type { ApiError } from "@haccp/shared";

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }

  toJSON(requestId?: string): ApiError {
    return {
      error: this.code,
      message: this.message,
      ...(this.details !== undefined ? { details: this.details } : {}),
      ...(requestId ? { requestId } : {}),
    };
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details?: unknown) {
    super("NOT_FOUND", 404, message, details);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super("VALIDATION_ERROR", 400, message, details);
    this.name = "ValidationError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict", details?: unknown) {
    super("CONFLICT", 409, message, details);
    this.name = "ConflictError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", details?: unknown) {
    super("UNAUTHORIZED", 401, message, details);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", details?: unknown) {
    super("FORBIDDEN", 403, message, details);
    this.name = "ForbiddenError";
  }
}

export class InternalError extends AppError {
  constructor(message = "An unexpected error occurred", details?: unknown) {
    super("INTERNAL_SERVER_ERROR", 500, message, details);
    this.name = "InternalError";
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Service temporarily unavailable", details?: unknown) {
    super("SERVICE_UNAVAILABLE", 503, message, details);
    this.name = "ServiceUnavailableError";
  }
}

export class RoleUpdateOutcomeUnknownError extends AppError {
  constructor(
    message = "Could not confirm whether the role change was applied. Please try again.",
    details?: unknown,
  ) {
    super("ROLE_UPDATE_OUTCOME_UNKNOWN", 503, message, details);
    this.name = "RoleUpdateOutcomeUnknownError";
  }
}

export class RoleProjectionFailedError extends AppError {
  constructor(
    message = "The role was updated but could not be saved locally yet. It will be corrected automatically.",
    details?: unknown,
  ) {
    super("ROLE_PROJECTION_FAILED", 500, message, details);
    this.name = "RoleProjectionFailedError";
  }
}
