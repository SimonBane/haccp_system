#!/usr/bin/env node
/**
 * Asserts that each test file is run by exactly one suite, and that no suite
 * collects build output.
 *
 * Two regressions this exists to catch:
 *
 * 1. Vitest 4's default `exclude` is only node_modules and .git. Before the
 *    configs in packages/vitest-config, a run that happened after a build also
 *    collected the compiled copies emitted into dist — every suite ran twice, the
 *    second time against stale JavaScript.
 * 2. Unit and integration discovery overlapping. The unit suite must stay
 *    hermetic; an integration test leaking into it turns `pnpm turbo test` into
 *    something that needs Postgres and Redis to pass.
 *
 * Git is the right oracle for both: dist is ignored, so a build artifact can
 * never appear in the expected set, whatever the configs happen to say.
 *
 * Run it AFTER a build — before one, dist is empty and (1) is invisible.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/** @param {string[]} args */
function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

/**
 * Finds each suite from its tracked config, so a new workspace package cannot
 * quietly escape this check.
 *
 * @param {string} configName
 * @returns {{ dir: string, config: string }[]}
 */
function projects(configName) {
  return git(["ls-files", configName, `*/${configName}`, `*/*/${configName}`])
    .map((configPath) => ({
      dir: path.dirname(configPath),
      config: path.basename(configPath),
    }))
    .sort((a, b) => a.dir.localeCompare(b.dir));
}

/** @param {{ dir: string, config: string }} project */
function collectedFiles(project) {
  const stdout = execFileSync(
    "npx",
    ["vitest", "list", "--filesOnly", "--json", "--config", project.config],
    {
      cwd: path.join(repoRoot, project.dir),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  // `list` can emit loader warnings before the payload; take the JSON array only.
  const start = stdout.indexOf("[");
  if (start === -1) {
    throw new Error(
      `vitest list produced no JSON for ${project.dir}:\n${stdout}`,
    );
  }

  return JSON.parse(stdout.slice(start)).map((entry) =>
    path.relative(repoRoot, entry.file),
  );
}

const trackedTests = git(["ls-files", "*.test.ts", "*.test.tsx"]);
const isIntegration = (/** @type {string} */ file) =>
  file.endsWith(".integration.test.ts");

/** Unit tests are colocated in src/; integration tests are not, by convention. */
const expectedUnit = new Set(
  trackedTests.filter((file) => file.includes("/src/") && !isIntegration(file)),
);
const expectedIntegration = new Set(trackedTests.filter(isIntegration));

const collectedUnit = projects("vitest.config.*").flatMap(collectedFiles);
const collectedIntegration = projects("vitest.integration.config.*").flatMap(
  collectedFiles,
);

/** @type {string[]} */
const problems = [];

/**
 * @param {string} label
 * @param {string[]} collected
 * @param {Set<string>} expected
 */
function check(label, collected, expected) {
  const duplicates = collected.filter(
    (file, index) => collected.indexOf(file) !== index,
  );
  if (duplicates.length > 0) {
    problems.push(
      `${label}: collected the same test file more than once:\n  ${[...new Set(duplicates)].join("\n  ")}`,
    );
  }

  const artifacts = collected.filter((file) =>
    /(^|\/)(dist|\.next|build|coverage)\//.test(file),
  );
  if (artifacts.length > 0) {
    problems.push(
      `${label}: collected build output instead of source:\n  ${artifacts.join("\n  ")}`,
    );
  }

  const collectedSet = new Set(collected);

  const missing = [...expected].filter((file) => !collectedSet.has(file));
  if (missing.length > 0) {
    problems.push(
      `${label}: tracked test files that no suite runs:\n  ${missing.join("\n  ")}`,
    );
  }

  const unexpected = [...collectedSet].filter((file) => !expected.has(file));
  if (unexpected.length > 0) {
    problems.push(
      `${label}: collected files git does not track for this suite:\n  ${unexpected.join("\n  ")}`,
    );
  }
}

check("unit", collectedUnit, expectedUnit);
check("integration", collectedIntegration, expectedIntegration);

const overlap = collectedUnit.filter((file) =>
  new Set(collectedIntegration).has(file),
);
if (overlap.length > 0) {
  problems.push(
    `the unit and integration suites both collect:\n  ${overlap.join("\n  ")}`,
  );
}

if (problems.length > 0) {
  console.error(`Test discovery check failed.\n\n${problems.join("\n\n")}\n`);
  process.exit(1);
}

console.log(
  `Test discovery OK — ${collectedUnit.length} unit and ${collectedIntegration.length} integration test files, each collected exactly once, with no overlap.`,
);
