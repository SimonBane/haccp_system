import { apiErrorSchema } from "@haccp/shared";
import { env } from "../../env.js";

export const openApiDocument = {
  openapi: "3.0.0" as const,
  info: {
    title: "HACCP API",
    version: "0.1.0",
    description: "HACCP management platform REST API",
  },
  servers: [
    {
      url: `http://localhost:${env.API_PORT}`,
      description: "Local development",
    },
  ],
  tags: [
    { name: "Health", description: "Service health checks" },
    { name: "Me", description: "Authenticated user context" },
    { name: "Locations", description: "Organization locations" },
    { name: "Equipment", description: "Temperature-monitored equipment" },
    { name: "Task Templates", description: "Recurring HACCP task templates" },
    { name: "Today", description: "Daily task board and completions" },
  ],
  components: {
    securitySchemes: {
      Bearer: {
        type: "http" as const,
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      ApiError: apiErrorSchema,
    },
  },
  security: [{ Bearer: [] }],
};
