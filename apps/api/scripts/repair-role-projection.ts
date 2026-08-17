/**
 * Operator repair: re-reads Clerk's authoritative role for one membership and
 * corrects the local projection if it has drifted. Never writes to Clerk — the
 * webhook is the normal correction channel; this is for a stuck manual case
 * (e.g. a missed/failed webhook) where an admin needs to fix one membership now.
 *
 * Usage: pnpm --filter @haccp/api repair:role-projection <clerkOrgId> <clerkUserId>
 */
import { closeDb, db } from "../src/core/db/client.js";
import { employeeRepository } from "../src/modules/employees/employee.repository.js";
import { membershipService } from "../src/modules/memberships/membership.service.js";
import { closeRedis } from "../src/core/redis/client.js";

async function main(): Promise<void> {
  const [clerkOrgId, clerkUserId] = process.argv.slice(2);

  if (!clerkOrgId || !clerkUserId) {
    console.error(
      "Usage: pnpm --filter @haccp/api repair:role-projection <clerkOrgId> <clerkUserId>",
    );
    process.exitCode = 1;
    return;
  }

  const before = await employeeRepository.findMembershipByClerkIds(
    db,
    clerkOrgId,
    clerkUserId,
  );

  if (!before) {
    console.error(`No membership found for ${clerkOrgId} / ${clerkUserId}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Before: membership ${before.membership.id} role=${before.membership.role}`,
  );

  await membershipService.syncRoleByClerkIds(db, clerkOrgId, clerkUserId);

  const after = await employeeRepository.findMembershipByClerkIds(
    db,
    clerkOrgId,
    clerkUserId,
  );

  console.log(
    after
      ? `After:  membership ${after.membership.id} role=${after.membership.role}`
      : "After:  membership no longer exists (removed in Clerk)",
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([closeDb(), closeRedis()]);
  });
