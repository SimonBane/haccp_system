import { sql } from "drizzle-orm";
import type { Db } from "../../../src/core/db/client.js";

let cachedTableNames: string[] | null = null;

/**
 * Empties every application table between tests.
 *
 * Transaction-per-test rollback cannot work here: requests use the module-scope
 * `db` singleton and postgres.js hands out a different pooled connection per
 * statement, so the code under test would never be inside the test's transaction.
 *
 * Names come from the catalog so a new table is covered automatically.
 * `schemaname = 'public'` matters — drizzle's migration ledger lives in the
 * `drizzle` schema, and truncating it would make the database look unmigrated.
 */
export async function truncateAll(db: Db): Promise<void> {
  cachedTableNames ??= (
    await db.execute<{ tablename: string }>(
      sql`select tablename from pg_tables where schemaname = 'public'`,
    )
  ).map((row) => row.tablename);

  if (cachedTableNames.length === 0) {
    return;
  }

  const targets = cachedTableNames
    .map((name) => `"public"."${name}"`)
    .join(", ");

  // CASCADE: the schema mixes restrict and cascade FKs, so hand-ordered deletes would rot.
  await db.execute(
    sql.raw(`truncate table ${targets} restart identity cascade`),
  );
}

/** SQLSTATE from a driver error, for asserting constraints without matching message text. */
export function postgresErrorCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code } = error as { code: unknown };
    if (typeof code === "string") {
      return code;
    }
  }

  if (typeof error === "object" && error !== null && "cause" in error) {
    return postgresErrorCode((error as { cause: unknown }).cause);
  }

  return null;
}

export const PG_ERROR = {
  UNIQUE_VIOLATION: "23505",
  FOREIGN_KEY_VIOLATION: "23503",
  CHECK_VIOLATION: "23514",
} as const;
