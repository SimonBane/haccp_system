import { and, eq, isNull } from "drizzle-orm";
import type { Db, DbClient } from "../../core/db/client.js";
import { organizations } from "../../core/db/schema/organizations.js";

export const organizationRepository = {
  async findByClerkOrgId(db: Db, clerkOrgId: string) {
    const [row] = await db
      .select()
      .from(organizations)
      .where(
        and(
          eq(organizations.clerkOrgId, clerkOrgId),
          isNull(organizations.deletedAt),
        ),
      )
      .limit(1);

    return row ?? null;
  },

  async findById(db: Db, organizationId: string) {
    const [row] = await db
      .select()
      .from(organizations)
      .where(
        and(
          eq(organizations.id, organizationId),
          isNull(organizations.deletedAt),
        ),
      )
      .limit(1);

    return row ?? null;
  },

  async insert(db: DbClient, data: typeof organizations.$inferInsert) {
    const [created] = await db.insert(organizations).values(data).returning();
    return created ?? null;
  },

  async updateById(
    db: Db,
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

  async updateNameByClerkOrgId(db: Db, clerkOrgId: string, name: string) {
    const [updated] = await db
      .update(organizations)
      .set({ name, updatedAt: new Date() })
      .where(eq(organizations.clerkOrgId, clerkOrgId))
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
