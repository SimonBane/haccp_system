import { defaultExclude, defineConfig, mergeConfig } from "vitest/config";

/**
 * Unit suites run against source only.
 *
 * Vitest 4's `defaultExclude` is just node_modules and .git — it does *not* skip
 * `dist`. Because `apps/api` and `packages/shared` emit their colocated tests when
 * they build, an unconfigured run collected both the source test and its compiled
 * copy, executing every suite twice against two different versions of the code.
 * Anchoring `include` to `src/` is what fixes that; the explicit build-output
 * excludes below are there so the intent survives someone widening `include`.
 */
export const UNIT_INCLUDE = ["src/**/*.test.ts", "src/**/*.test.tsx"];

export const UNIT_EXCLUDE = [
  ...defaultExclude,
  "**/dist/**",
  "**/.next/**",
  "**/.turbo/**",
  "**/build/**",
  "**/coverage/**",
  // Anything needing real infrastructure or a browser lives outside src/ and runs
  // from its own config. Keeping it out here is what makes `test` fast and hermetic.
  "**/tests/**",
  "**/e2e/**",
  "**/*.integration.test.ts",
];

/**
 * @param {import("vitest/config").ViteUserConfig} [overrides]
 * @returns {import("vitest/config").ViteUserConfig}
 */
export function defineUnitConfig(overrides = {}) {
  return mergeConfig(
    defineConfig({
      test: {
        include: UNIT_INCLUDE,
        exclude: UNIT_EXCLUDE,
        passWithNoTests: false,
      },
    }),
    defineConfig(overrides),
  );
}
