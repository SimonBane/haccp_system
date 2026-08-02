import type { UserResponse } from "@haccp/shared";
import { normalizeEmail } from "@haccp/shared";
import type { Db, DbClient } from "../../core/db/client.js";
import type { User } from "../../core/db/schema/users.js";
import { ConflictError, NotFoundError } from "../../core/errors/app-errors.js";
import { mapDbMutationError } from "../../lib/db-errors.js";
import { buildUserCacheBlob, userCache } from "./user-cache.js";
import {
  extractClerkProfile,
  toUserResponse,
  type ClerkUserProfile,
} from "./user.mapper.js";
import { userRepository } from "./user.repository.js";

function normalizeName(value: string | undefined | null): string {
  return value?.trim() ?? "";
}

export const userService = {
  async createDraftUser(
    db: DbClient,
    input: { email: string; firstName?: string; lastName?: string },
  ) {
    const email = normalizeEmail(input.email);

    try {
      return await userRepository.insert(db, {
        email,
        firstName: normalizeName(input.firstName),
        lastName: normalizeName(input.lastName),
        clerkUserId: null,
        imageUrl: "",
        hasImage: false,
      });
    } catch (error) {
      mapDbMutationError(error, {
        unique: () => new ConflictError("A user with this email already exists"),
      });
    }
  },

  async resolveUser(db: Db, clerkUserId: string): Promise<UserResponse | null> {
    const cached = await userCache.get(clerkUserId);
    if (cached) {
      return cached;
    }

    const user = await userRepository.findByClerkUserId(db, clerkUserId);
    if (!user) {
      return null;
    }

    const response = toUserResponse(user);
    await userCache.set(clerkUserId, buildUserCacheBlob(response));
    return response;
  },

  async requireUser(db: Db, clerkUserId: string): Promise<UserResponse> {
    const user = await this.resolveUser(db, clerkUserId);

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return user;
  },

  async syncUserFromClerk(
    db: Db,
    clerkUserId: string,
    profile: ClerkUserProfile,
    existingUser?: User | null,
  ): Promise<User | null> {
    const profileData = {
      clerkUserId,
      firstName: normalizeName(profile.firstName),
      lastName: normalizeName(profile.lastName),
      email: normalizeEmail(profile.email),
      imageUrl: profile.imageUrl,
      hasImage: profile.hasImage,
    };

    try {
      const existing =
        existingUser !== undefined
          ? existingUser
          : await userRepository.findAnyByClerkUserId(db, clerkUserId);

      if (existing?.deletedAt) {
        return null;
      }

      const user = existing
        ? await userRepository.updateById(db, existing.id, profileData)
        : await userRepository.insert(db, profileData);

      if (user) {
        await userCache.set(clerkUserId, buildUserCacheBlob(toUserResponse(user)));
      }

      return user;
    } catch (error) {
      mapDbMutationError(error, {
        unique: () => new ConflictError("A user with this email already exists"),
      });
    }
  },

  async syncUserFromClerkWebhook(
    db: Db,
    clerkUserId: string,
    data: Parameters<typeof extractClerkProfile>[0],
  ): Promise<User | null> {
    const existing = await userRepository.findAnyByClerkUserId(db, clerkUserId);

    if (!existing || existing.deletedAt) {
      return null;
    }

    return this.syncUserFromClerk(
      db,
      clerkUserId,
      extractClerkProfile(data),
      existing,
    );
  },

  async linkClerkProfileToDraftUser(
    db: Db,
    userId: string,
    clerkUserId: string,
    profile: ClerkUserProfile,
  ): Promise<User | null> {
    try {
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
    } catch (error) {
      mapDbMutationError(error, {
        unique: () => new ConflictError("A user with this email already exists"),
      });
    }
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
    try {
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
        await userCache.set(
          user.clerkUserId,
          buildUserCacheBlob(toUserResponse(user)),
        );
      }

      return user;
    } catch (error) {
      mapDbMutationError(error, {
        unique: () => new ConflictError("A user with this email already exists"),
      });
    }
  },

  async invalidateCache(clerkUserId: string): Promise<void> {
    await userCache.invalidate(clerkUserId);
  },
};
