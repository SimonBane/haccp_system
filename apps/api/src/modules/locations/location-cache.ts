import type { LocationResponse } from "@haccp/shared";

const DEFAULT_TTL_MS = 2 * 24 * 60 * 60 * 1000;

type CacheEntry = {
  location: LocationResponse;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

export const locationCache = {
  get(orgId: string): LocationResponse | null {
    const entry = cache.get(orgId);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      cache.delete(orgId);
      return null;
    }

    return entry.location;
  },

  set(orgId: string, location: LocationResponse, ttlMs = DEFAULT_TTL_MS): void {
    cache.set(orgId, {
      location,
      expiresAt: Date.now() + ttlMs,
    });
  },

  invalidate(orgId: string): void {
    cache.delete(orgId);
  },
};
