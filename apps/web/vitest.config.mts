import { defineUnitConfig } from "@haccp/vitest-config/unit";

// `.mts` because apps/web is not `"type": "module"` — a plain `.ts` config gets
// loaded as CommonJS and Vite warns about the ESM syntax.
//
// The default `node` environment is deliberate: everything covered here is pure
// logic (cache patches, timeline building, selection ranges). Component tests would
// need jsdom and a renderer, which is a separate decision from this config.
export default defineUnitConfig();
