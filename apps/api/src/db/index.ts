import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env.js";
import * as schema from "./schema/index.js";

const queryClient = postgres(env.DATABASE_URL, {
  prepare: false,
  max: process.env.VERCEL ? 1 : env.NODE_ENV === "production" ? 10 : 5,
});

export const db = drizzle(queryClient, { schema });
export type Db = typeof db;

export async function closeDb(): Promise<void> {
  await queryClient.end();
}
