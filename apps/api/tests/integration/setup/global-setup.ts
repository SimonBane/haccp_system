import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { TEST_DATABASE_URL } from "../harness/test-env.js";

const migrationsFolder = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../drizzle",
);

/**
 * Builds the test database once per run from the committed migrations.
 *
 * The programmatic migrator, not drizzle-kit: drizzle.config.ts loads .env.local
 * and would point the CLI at the developer's own database.
 */
export default async function setup(): Promise<void> {
  const url = new URL(TEST_DATABASE_URL);
  const databaseName = decodeURIComponent(url.pathname.slice(1));

  if (!databaseName) {
    throw new Error(`Could not read a database name from ${TEST_DATABASE_URL}`);
  }

  // Every run drops this database; refuse anything that is not clearly the test one.
  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `Refusing to drop "${databaseName}": the integration database name must end in "_test".`,
    );
  }

  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";

  // onnotice: migrations emit expected "identifier will be truncated" notices.
  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });

  try {
    // FORCE so a connection left by an interrupted run cannot block the drop.
    await admin.unsafe(
      `drop database if exists "${databaseName}" with (force)`,
    );
    await admin.unsafe(`create database "${databaseName}"`);
  } finally {
    await admin.end({ timeout: 5 });
  }

  const client = postgres(url.toString(), { max: 1, onnotice: () => {} });

  try {
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.end({ timeout: 5 });
  }
}
