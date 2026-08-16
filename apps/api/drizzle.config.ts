import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Captured before dotenv: .env.local loads with override: true, which would
// otherwise replace an explicitly exported URL (a test database, or CI's service).
const exportedDatabaseUrl = process.env.DIRECT_DATABASE_URL;

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), ".env") });
config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), ".env.local"),
  override: true,
});

const directDatabaseUrl =
  exportedDatabaseUrl ?? process.env.DIRECT_DATABASE_URL;

if (!directDatabaseUrl) {
  throw new Error(
    "DIRECT_DATABASE_URL is not set. Copy apps/api/.env.example to apps/api/.env and set DIRECT_DATABASE_URL (or use local Docker URLs in .env.local).",
  );
}

export default defineConfig({
  schema: "./src/core/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: directDatabaseUrl,
  },
});
