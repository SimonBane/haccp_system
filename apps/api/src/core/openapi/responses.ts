import { apiErrorSchema } from "@haccp/shared";
import type { z } from "zod";

export function errorResponse(description: string) {
  return {
    description,
    content: {
      "application/json": {
        schema: apiErrorSchema,
      },
    },
  };
}

export function jsonResponse<T extends z.ZodType>(
  schema: T,
  description = "Success",
) {
  return {
    description,
    content: {
      "application/json": {
        schema,
      },
    },
  };
}
