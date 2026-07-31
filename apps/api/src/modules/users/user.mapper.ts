import type { UserResponse } from "@haccp/shared";
import type { User } from "../../core/db/schema/users.js";

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    clerkUserId: user.clerkUserId,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    imageUrl: user.imageUrl,
    hasImage: user.hasImage,
  };
}

export function toUserSummary(user: User) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

export function toUserSummaryFromResponse(user: UserResponse) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

export type ClerkUserProfile = {
  firstName: string;
  lastName: string;
  email: string;
  imageUrl: string;
  hasImage: boolean;
};

export function extractClerkProfile(data: {
  first_name?: string | null;
  last_name?: string | null;
  email_addresses?: Array<{ id: string; email_address: string }>;
  primary_email_address_id?: string | null;
  image_url?: string;
  has_image?: boolean;
}): ClerkUserProfile {
  const primaryEmail = data.email_addresses?.find(
    (entry) => entry.id === data.primary_email_address_id,
  );

  return {
    firstName: data.first_name?.trim() || "",
    lastName: data.last_name?.trim() || "",
    email: primaryEmail?.email_address ?? "",
    imageUrl: data.image_url ?? "",
    hasImage: data.has_image ?? false,
  };
}

export function mapClerkApiUserToProfile(user: {
  firstName: string | null;
  lastName: string | null;
  emailAddresses: Array<{ id: string; emailAddress: string }>;
  primaryEmailAddressId: string | null;
  imageUrl: string;
  hasImage: boolean;
}): ClerkUserProfile {
  const primaryEmail = user.emailAddresses.find(
    (entry) => entry.id === user.primaryEmailAddressId,
  );

  return {
    firstName: user.firstName?.trim() || "",
    lastName: user.lastName?.trim() || "",
    email:
      primaryEmail?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? "",
    imageUrl: user.imageUrl ?? "",
    hasImage: user.hasImage ?? false,
  };
}
