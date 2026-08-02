import type { UserResponse } from "@haccp/shared";
import { normalizeEmail } from "@haccp/shared";
import type { Db, DbClient } from "../../core/db/client.js";
import type { User } from "../../core/db/schema/users.js";
import { ConflictError, InternalError, NotFoundError } from "../../core/errors/app-errors.js";
import { mapDbMutationError } from "../../lib/db-errors.js";
import { buildUserCacheBlob, userCache } from "./user-cache.js";
import {
  buildClerkProfileData,
  toUserResponse,
  type ClerkProfileData,
  type ClerkUserProfile,
} from "./user.mapper.js";
import { userRepository } from "./user.repository.js";

function normalizeName(value: string | undefined | null): string {
  return value?.trim() ?? "";
}

async function persistUserAndCache(
  db: DbClient,
  profileData: ClerkProfileData,
  existingUserId?: string,
): Promise<User> {
  const user = existingUserId
    ? await userRepository.updateById(db, existingUserId, profileData)
    : await userRepository.insert(db, profileData);

  if (!user) {
    throw existingUserId
      ? new NotFoundError("User not found")
      : new InternalError("Failed to create user");
  }

  await userCache.set(
    profileData.clerkUserId,
    buildUserCacheBlob(toUserResponse(user)),
  );
  return user;
}

export const userService = {
  async ensureDraftUser(
    db: DbClient,
    input: { email: string; firstName?: string; lastName?: string },
  ) {
    try {
      const email = normalizeEmail(input.email);
      const existing = await userRepository.findByEmail(db, email);
      if (existing) {
        return existing;
      }

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

  async syncUserFromClerk(
    db: Db,
    clerkUserId: string,
    profile: ClerkUserProfile
  ): Promise<User | null> {
    try {
      const existing = await userRepository.findAnyByClerkUserId(db, clerkUserId);
      if (!existing) {
        return null;
      }

      const profileData = buildClerkProfileData(clerkUserId, profile);

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

  async linkClerkProfileToDraftUser(
    db: DbClient,
    userId: string,
    profileData: ClerkProfileData,
  ): Promise<User | null> {
    try {
      return await persistUserAndCache(db, profileData, userId);
    } catch (error) {
      mapDbMutationError(error, {
        unique: () => new ConflictError("A user with this email already exists"),
      });
    }
  },

  async upsertUserFromClerk(
    db: DbClient,
    profileData: ClerkProfileData,
  ): Promise<User> {
    try {
      const existing = await userRepository.findByClerkUserIdOrEmail(
        db,
        profileData.clerkUserId,
        profileData.email,
      );

      return persistUserAndCache(db, profileData, existing?.id);
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
