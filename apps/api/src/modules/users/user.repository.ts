import { and, eq, isNull, or, sql } from "drizzle-orm";
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

  async findAnyByClerkUserId(db: DbClient, clerkUserId: string) {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);

    return row ?? null;
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
      .where(sql`lower(${users.email}) = lower(${email})`)
      .limit(1);

    return row ?? null;
  },

  async findByClerkUserIdOrEmail(
    db: DbClient,
    clerkUserId: string,
    email: string,
  ) {
    const [row] = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.clerkUserId, clerkUserId),
          sql`lower(${users.email}) = lower(${email})`,
        ),
      )
      .orderBy(sql`(${users.clerkUserId} = ${clerkUserId}) desc`)
      .limit(1);

    return row ?? null;
  },
};
