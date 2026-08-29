import { API_ERROR_CODE, type ApiError } from "@haccp/shared";

type AppErrorOptions = {
  code?: string;
};

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }

  toJSON(requestId: string): ApiError {
    return {
      error: this.code,
      message: this.message,
      requestId,
    };
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", options?: AppErrorOptions) {
    super(options?.code ?? API_ERROR_CODE.NOT_FOUND, 404, message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", options?: AppErrorOptions) {
    super(options?.code ?? API_ERROR_CODE.VALIDATION, 400, message);
    this.name = "ValidationError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict", options?: AppErrorOptions) {
    super(options?.code ?? API_ERROR_CODE.CONFLICT, 409, message);
    this.name = "ConflictError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", options?: AppErrorOptions) {
    super(options?.code ?? API_ERROR_CODE.UNAUTHORIZED, 401, message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", options?: AppErrorOptions) {
    super(options?.code ?? API_ERROR_CODE.FORBIDDEN, 403, message);
    this.name = "ForbiddenError";
  }
}

export class InternalError extends AppError {
  constructor(
    message = "An unexpected error occurred",
    options?: AppErrorOptions,
  ) {
    super(options?.code ?? API_ERROR_CODE.INTERNAL, 500, message);
    this.name = "InternalError";
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(
    message = "Service temporarily unavailable",
    options?: AppErrorOptions,
  ) {
    super(options?.code ?? API_ERROR_CODE.SERVICE_UNAVAILABLE, 503, message);
    this.name = "ServiceUnavailableError";
  }
}
