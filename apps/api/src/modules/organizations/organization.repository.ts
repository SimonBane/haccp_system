import { eq } from "drizzle-orm";
import type { Db, DbClient } from "../../core/db/client.js";
import { organizations } from "../../core/db/schema/organizations.js";

export const organizationRepository = {


  async insert(db: DbClient, data: typeof organizations.$inferInsert) {
    const [created] = await db.insert(organizations).values(data).returning();
    return created ?? null;
  },

  async updateById(
    db: DbClient,
    organizationId: string,
    updates: Partial<typeof organizations.$inferInsert>,
  ) {
    const [updated] = await db
      .update(organizations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(organizations.id, organizationId))
      .returning();

    return updated ?? null;
  },


  async updateByClerkOrgId(
    db: Db,
    clerkOrgId: string,
    updates: Partial<typeof organizations.$inferInsert>,
  ) {
    const [updated] = await db
      .update(organizations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(organizations.clerkOrgId, clerkOrgId))
      .returning();

    return updated ?? null;
  },

  async softDeleteByClerkOrgId(db: Db, clerkOrgId: string) {
    const [updated] = await db
      .update(organizations)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(organizations.clerkOrgId, clerkOrgId))
      .returning();

    return updated ?? null;
  },

  async findAnyByClerkOrgId(db: Db, clerkOrgId: string) {
    const [row] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.clerkOrgId, clerkOrgId))
      .limit(1);

    return row ?? null;
  },
};
