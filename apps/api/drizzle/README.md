# Migrations

**Migrations are generated, never hand-written.**

```bash
# 1. edit src/core/db/schema/*.ts
pnpm --filter @haccp/api db:generate   # writes the .sql AND the meta/ snapshot
pnpm --filter @haccp/api db:migrate    # applies it locally
# 2. commit the schema change, the .sql, and meta/ together
```

## Why the rule exists

`drizzle-kit generate` diffs your TS schema against `meta/<latest>_snapshot.json`
— the newest snapshot in `meta/`, not the database. Writing SQL by hand leaves
that snapshot describing an older world, and every later `generate` then diffs
against the stale one and emits DDL that re-creates columns you already dropped.

This repo hit exactly that: migrations `0007`–`0011` were hand-written, snapshots
stopped at `0006`, and the next `generate` would have emitted a destructive
migration against a five-table schema that no longer existed. Those twelve
migrations were squashed into `0001_baseline.sql` on 2026-08-08, verified
semantically identical (columns, indexes, constraints, extensions) to the chain
they replace.

The chain grew back to eight migrations (`0000`–`0007`) through normal schema
work; it was re-squashed into `0001_baseline.sql` on 2026-08-21, again verified
byte-for-byte identical (`information_schema.columns`, `pg_indexes`,
`pg_constraint`, `pg_extension`) on scratch databases against the previous
`0001`–`0007` chain before deleting it.

The same day, the hand-written `0000_enable_pgcrypto.sql` was removed and
everything folded into a single `0000_baseline.sql`: nothing in the schema uses
a pgcrypto function, `gen_random_uuid()` has been core since Postgres 13, and a
fresh scratch database confirmed inserts work with no extensions installed
beyond `plpgsql`. Existing databases still have `pgcrypto` installed (nothing
drops it) — this only stops the extension from being (re-)created going
forward.

On 2026-10-10 the chain was reset to a fresh `0000_baseline.sql` for the
configurable forms rework (equipment and temperature-only records replaced by
targets, versioned forms and readings). No existing data was kept, so this
reset was not re-ledgered: every database is recreated empty and migrated from
the new baseline.

On 2026-11-18 that baseline and its follow-ups `0001`–`0004` (fixed target kinds,
fixtures, name length limits) were squashed into a regenerated `0000_baseline.sql`,
verified identical on scratch databases as above. Again no data was kept: every
database is recreated empty.

On 2026-11-19 `0000_baseline.sql` was regenerated in place for self-describing
records, and on 2026-11-22 again to fold in record deviations and on-demand
forms, then to drop task titles (tasks take their form's name). No data was
kept: every database is recreated empty.

On 2026-11-23 it was regenerated again to enable row-level security on every
table, so Supabase's Data API roles see nothing; the API connects as the owner
and bypasses it. No data was kept: every database is recreated empty.

CI enforces the rule: `validate-migrations` runs `db:check` and fails if it
produces a migration, which catches both a schema change with no migration and a
migration the snapshots never saw.

## Recovering if the snapshots drift again

1. Verify the TS schema still matches the migration chain, **on a scratch
   database only**: apply the chain to DB A, generate a baseline into a temp
   directory, apply that to DB B, then diff `information_schema.columns`,
   `pg_indexes`, `pg_constraint`, and `pg_extension` between them.
2. If they match, squash: delete every `.sql` file and every
   `meta/*_snapshot.json`, reset `meta/_journal.json` to an empty `entries`
   array, and run `db:generate --name=baseline` (writes `0000_baseline.sql`).
3. Confirm `db:generate` then prints *"No schema changes, nothing to migrate"*.
4. On every database that already ran the old chain, replace the old ledger rows:

   ```sql
   DELETE FROM drizzle.__drizzle_migrations;
   INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
   VALUES ('<sha256 of 0000_baseline.sql>', <0000's "when" from _journal.json>);
   ```

   The hash is a plain SHA-256 of the migration file's full contents; `created_at`
   is the `when` value from `meta/_journal.json`.

Never run `drizzle-kit push` against a real database, and never use
`generate --custom` to repair snapshots — it writes the *previous* snapshot's
contents under a new id, freezing the drift permanently.
