import { defaultExclude, defineConfig, mergeConfig } from "vitest/config";

/**
 * Suites that use real Postgres and Redis.
 *
 * Serial throughout: the db and Redis clients are module-scope singletons and
 * `single-flight` is process-global, so parallel workers would share one database
 * while truncating under each other. `isolate` stays default — each file needs its
 * own clients to close in `afterAll`.
 */
export const INTEGRATION_INCLUDE = ["tests/**/*.integration.test.ts"];

/**
 * @param {import("vitest/config").ViteUserConfig} [overrides]
 * @returns {import("vitest/config").ViteUserConfig}
 */
export function defineIntegrationConfig(overrides = {}) {
  return mergeConfig(
    defineConfig({
      test: {
        include: INTEGRATION_INCLUDE,
        exclude: [...defaultExclude, "**/dist/**"],
        pool: "forks",
        // Vitest 4 flattened poolOptions to the top level.
        maxWorkers: 1,
        minWorkers: 1,
        fileParallelism: false,
        hookTimeout: 60_000,
        testTimeout: 20_000,
      },
    }),
    defineConfig(overrides),
  );
}
