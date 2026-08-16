import type { ViteUserConfig } from "vitest/config";

export declare const UNIT_INCLUDE: string[];
export declare const UNIT_EXCLUDE: string[];
export declare function defineUnitConfig(
  overrides?: ViteUserConfig,
): ViteUserConfig;
