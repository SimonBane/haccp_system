import type { Db, DbClient } from "../../core/db/client.js";
import { clerkClient } from "../../core/auth/clerk-client.js";
import type { User } from "../../core/db/schema/users.js";
import { buildUserCacheBlob, userCache } from "./user-cache.js";
import {
  extractClerkProfile,
  mapClerkApiUserToProfile,
  toUserResponse,
  type ClerkUserProfile,
} from "./user.mapper.js";
import { userRepository } from "./user.repository.js";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeName(value: string | undefined | null): string {
  return value?.trim() ?? "";
}

export const userService = {
  async createDraftUser(
    db: DbClient,
    input: { email: string; firstName?: string; lastName?: string },
  ) {
    return userRepository.insert(db, {
      email: normalizeEmail(input.email),
      firstName: normalizeName(input.firstName),
      lastName: normalizeName(input.lastName),
      clerkUserId: null,
      imageUrl: "",
      hasImage: false,
    });
  },

  async resolveUserDbId(db: Db, clerkUserId: string): Promise<string | null> {
    const cached = await userCache.get(clerkUserId);

    if (cached) {
      return cached.id;
    }

    const user = await userRepository.findByClerkUserId(db, clerkUserId);

    if (!user) {
      return null;
    }

    await userCache.set(clerkUserId, buildUserCacheBlob(toUserResponse(user)));
    return user.id;
  },

  async resolveOrSyncUserDbId(
    db: Db,
    clerkUserId: string,
  ): Promise<string | null> {
    const existingId = await this.resolveUserDbId(db, clerkUserId);

    if (existingId) {
      return existingId;
    }

    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const profile = mapClerkApiUserToProfile(clerkUser);

    if (profile.email) {
      const draftUser = await userRepository.findByEmail(db, profile.email);

      if (draftUser && !draftUser.clerkUserId) {
        const linked = await this.linkClerkProfileToDraftUser(
          db,
          draftUser.id,
          clerkUserId,
          profile,
        );

        return linked?.id ?? null;
      }
    }

    const user = await this.syncUserFromClerk(db, clerkUserId, profile);
    return user?.id ?? null;
  },

  async syncUserFromClerk(
    db: Db,
    clerkUserId: string,
    profile: ClerkUserProfile,
  ): Promise<User | null> {
    const existing = await userRepository.findAnyByClerkUserId(db, clerkUserId);

    if (existing?.deletedAt) {
      return null;
    }

    const profileData = {
      clerkUserId,
      firstName: normalizeName(profile.firstName),
      lastName: normalizeName(profile.lastName),
      email: normalizeEmail(profile.email),
      imageUrl: profile.imageUrl,
      hasImage: profile.hasImage,
    };

    const user = existing
      ? await userRepository.updateById(db, existing.id, profileData)
      : await userRepository.insert(db, profileData);

    if (user) {
      await userCache.set(clerkUserId, buildUserCacheBlob(toUserResponse(user)));
    }

    return user;
  },

  async syncUserFromClerkWebhook(
    db: Db,
    clerkUserId: string,
    data: Parameters<typeof extractClerkProfile>[0],
  ): Promise<User | null> {
    return this.syncUserFromClerk(db, clerkUserId, extractClerkProfile(data));
  },

  async linkClerkProfileToDraftUser(
    db: Db,
    userId: string,
    clerkUserId: string,
    profile: ClerkUserProfile,
  ): Promise<User | null> {
    const user = await userRepository.updateById(db, userId, {
      clerkUserId,
      firstName: normalizeName(profile.firstName),
      lastName: normalizeName(profile.lastName),
      email: normalizeEmail(profile.email),
      imageUrl: profile.imageUrl,
      hasImage: profile.hasImage,
    });

    if (user) {
      await userCache.set(clerkUserId, buildUserCacheBlob(toUserResponse(user)));
    }

    return user;
  },

  async updateProfile(
    db: DbClient,
    userId: string,
    updates: {
      email?: string;
      firstName?: string | null;
      lastName?: string | null;
    },
  ): Promise<User | null> {
    const user = await userRepository.updateById(db, userId, {
      email: updates.email ? normalizeEmail(updates.email) : undefined,
      firstName:
        updates.firstName !== undefined
          ? normalizeName(updates.firstName)
          : undefined,
      lastName:
        updates.lastName !== undefined
          ? normalizeName(updates.lastName)
          : undefined,
    });

    if (user?.clerkUserId) {
      await userCache.invalidate(user.clerkUserId);
      await userCache.set(
        user.clerkUserId,
        buildUserCacheBlob(toUserResponse(user)),
      );
    }

    return user;
  },

  async invalidateCache(clerkUserId: string): Promise<void> {
    await userCache.invalidate(clerkUserId);
  },
};
