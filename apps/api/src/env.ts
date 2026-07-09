import { z } from "zod";

const envSchema = z.object({
  API_PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
});

export const env = envSchema.parse({
  API_PORT: process.env.API_PORT,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
});
