import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// vitest's cwd is the package root (apps/api); the workflow lives at the repo root.
const workflowPath = fileURLToPath(
  new URL("../../../../.github/workflows/migrate.yml", import.meta.url),
);

describe("migrate.yml workflow", () => {
  it("scopes concurrency to a single group without cancelling an in-flight run", () => {
    const workflow = readFileSync(workflowPath, "utf-8");
    const concurrencyBlock = workflow.match(
      /^concurrency:\n((?: {2}.*\n?)+)/m,
    );

    expect(
      concurrencyBlock,
      "migrate.yml must declare a top-level concurrency block so two migration jobs can't run at once",
    ).not.toBeNull();

    const block = concurrencyBlock?.[1] ?? "";
    expect(block).toMatch(/group:\s*\S+/);
    // cancel-in-progress: false — cancelling a live migration mid-run would leave
    // the schema in an unknown state, so the second run must queue, not pre-empt.
    expect(block).toMatch(/cancel-in-progress:\s*false/);
  });
});
