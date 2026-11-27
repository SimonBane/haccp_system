import { parseArgs } from "node:util";
import { closeDb, db } from "../core/db/client.js";
import { closeRedis, getRedis } from "../core/redis/client.js";
import { env } from "../env.js";
import { tenantCache } from "../modules/tenant/tenant-cache.js";
import { SeedError, seedOrganization } from "./seed/seed.js";

const USAGE = `Seeds Bulgarian demo data (items, forms, tasks and their history) into one organization.

  pnpm --filter @haccp/api db:seed --org <clerk org id> [--days 60] [--reset] [--name "<org name>"]

  --org     Clerk organization id (org_...). Created with one location if it does not exist yet.
  --days    How many past days of records to generate (1-365, default 60).
  --reset   Delete data from an earlier seed run of this organization first.
  --name    Organization name, used only when the organization is created.`;

function parseOptions() {
  const { values } = parseArgs({
    // pnpm forwards a literal "--", which parseArgs would read as the end of options.
    args: process.argv.slice(2).filter((arg) => arg !== "--"),
    options: {
      org: { type: "string" },
      days: { type: "string", default: "60" },
      reset: { type: "boolean", default: false },
      name: { type: "string", default: "Демо месарница" },
      help: { type: "boolean", default: false },
    },
  });

  const days = Number(values.days);
  if (values.help || !values.org?.startsWith("org_")) return null;
  if (!Number.isInteger(days) || days < 1 || days > 365) return null;

  return {
    clerkOrgId: values.org,
    days,
    reset: values.reset,
    organizationName: values.name,
  };
}

async function main(): Promise<number> {
  const options = parseOptions();
  if (!options) {
    console.log(USAGE);
    return 1;
  }

  console.log(
    `Seeding ${options.clerkOrgId} on ${new URL(env.DATABASE_URL).host} (${options.days} days${options.reset ? ", reset" : ""})…`,
  );

  try {
    const summary = await seedOrganization(db, options);
    console.table(summary);
  } catch (error) {
    if (error instanceof SeedError) {
      console.error(error.message);
      return 1;
    }
    throw error;
  }

  // A rebuilt database leaves the cached tenant pointing at rows that no longer exist.
  try {
    await getRedis();
    await tenantCache.invalidate(options.clerkOrgId);
  } catch {
    console.warn("Redis unavailable: tenant cache not invalidated");
  }

  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => Promise.all([closeDb(), closeRedis()]));
