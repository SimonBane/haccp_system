import { fileURLToPath } from "node:url";
import { defineUnitConfig } from "@haccp/vitest-config/unit";

// `.mts` because apps/web is not `"type": "module"` — a plain `.ts` config gets
// loaded as CommonJS and Vite warns about the ESM syntax.
//
// The default `node` environment is deliberate: everything covered here is pure
// logic (cache patches, timeline building, selection ranges). Component tests would
// need jsdom and a renderer, which is a separate decision from this config.
export default defineUnitConfig({
  // Mirrors the `@/*` path in tsconfig, so a test imports a module the same way the
  // app does instead of reaching through relative paths.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
