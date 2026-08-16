import { defaultExclude, defineConfig, mergeConfig } from "vitest/config";

/**
 * Unit suites run against source only.
 *
 * Vitest 4 collects `dist` copies — `defaultExclude` is only node_modules and .git.
 * Anchor `include` to `src/`; the build-output excludes survive someone widening it.
 */
export const UNIT_INCLUDE = ["src/**/*.test.ts", "src/**/*.test.tsx"];

export const UNIT_EXCLUDE = [
  ...defaultExclude,
  "**/dist/**",
  "**/.next/**",
  "**/.turbo/**",
  "**/build/**",
  "**/coverage/**",
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
