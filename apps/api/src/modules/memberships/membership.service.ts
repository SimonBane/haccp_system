import type { Db } from "../../core/db/client.js";
import { employeeRepository } from "../employees/employee.repository.js";
import { membershipLocationsCache } from "../employees/membership-locations-cache.js";

export const membershipService = {
  async removeByClerkIds(
    db: Db,
    clerkOrgId: string,
    clerkUserId: string,
  ): Promise<void> {
    const row = await employeeRepository.findMembershipByClerkIds(
      db,
      clerkOrgId,
      clerkUserId,
    );

    if (!row) {
      return;
    }

    await employeeRepository.softDeleteById(db, row.membership.id);
    await membershipLocationsCache.invalidate(row.organizationId, row.userId);
  },
};
