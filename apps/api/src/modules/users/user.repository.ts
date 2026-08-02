import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Db, DbClient } from "../../core/db/client.js";
import { users } from "../../core/db/schema/users.js";

export const userRepository = {
  async findByClerkUserId(db: Db, clerkUserId: string) {
    const [row] = await db
      .select()
      .from(users)
      .where(
        and(eq(users.clerkUserId, clerkUserId), isNull(users.deletedAt)),
      )
      .limit(1);

    return row ?? null;
  },

  async findAnyByClerkUserId(db: Db, clerkUserId: string) {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);

    return row ?? null;
  },

  async findById(db: DbClient, userId: string) {
    const [row] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    return row ?? null;
  },

  async findByIds(db: Db, userIds: string[]) {
    if (userIds.length === 0) {
      return [];
    }

    return db
      .select()
      .from(users)
      .where(and(inArray(users.id, userIds), isNull(users.deletedAt)));
  },

  async insert(db: DbClient, data: typeof users.$inferInsert) {
    const [created] = await db.insert(users).values(data).returning();
    return created ?? null;
  },

  async updateById(
    db: DbClient,
    userId: string,
    updates: Partial<typeof users.$inferInsert>,
  ) {
    const [updated] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    return updated ?? null;
  },

  async softDeleteByClerkUserId(db: Db, clerkUserId: string) {
    const [updated] = await db
      .update(users)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.clerkUserId, clerkUserId))
      .returning();

    return updated ?? null;
  },

  async findByEmail(db: DbClient, email: string) {
    const [row] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email)))
      .limit(1);

    return row ?? null;
  },
};
