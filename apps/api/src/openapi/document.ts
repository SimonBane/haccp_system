import { env } from "../env.js";

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
};
