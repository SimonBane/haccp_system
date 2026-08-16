#!/usr/bin/env node
/**
 * Assert each source test is collected exactly once.
 *
 * Vitest 4 collects `dist` copies. Git is the oracle because dist is ignored.
 * Run AFTER a build — before one, dist is empty and the regression is invisible.
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
 * Packages that run a unit suite, from their tracked config so a new package cannot skip this check.
 */
function unitPackageDirs() {
  return git([
    "ls-files",
    "vitest.config.*",
    "*/vitest.config.*",
    "*/*/vitest.config.*",
  ])
    .map((configPath) => path.dirname(configPath))
    .sort();
}

/** @param {string} packageDir */
function collectedFiles(packageDir) {
  const stdout = execFileSync(
    "npx",
    ["vitest", "list", "--filesOnly", "--json"],
    {
      cwd: path.join(repoRoot, packageDir),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  // `list` can emit loader warnings before the payload; take the JSON array only.
  const start = stdout.indexOf("[");
  if (start === -1) {
    throw new Error(
      `vitest list produced no JSON for ${packageDir}:\n${stdout}`,
    );
  }

  return JSON.parse(stdout.slice(start)).map((entry) =>
    path.relative(repoRoot, entry.file),
  );
}

const expected = new Set(
  git(["ls-files", "*.test.ts", "*.test.tsx"]).filter((file) =>
    file.includes("/src/"),
  ),
);

const collected = unitPackageDirs().flatMap(collectedFiles);

/** @type {string[]} */
const problems = [];

const duplicates = collected.filter(
  (file, index) => collected.indexOf(file) !== index,
);
if (duplicates.length > 0) {
  problems.push(
    `collected the same test file more than once:\n  ${[...new Set(duplicates)].join("\n  ")}`,
  );
}

const artifacts = collected.filter((file) =>
  /(^|\/)(dist|\.next|build|coverage)\//.test(file),
);
if (artifacts.length > 0) {
  problems.push(
    `collected build output instead of source:\n  ${artifacts.join("\n  ")}`,
  );
}

const collectedSet = new Set(collected);
const missing = [...expected].filter((file) => !collectedSet.has(file));
if (missing.length > 0) {
  problems.push(
    `tracked source tests that no unit suite runs:\n  ${missing.join("\n  ")}`,
  );
}

const unexpected = [...collectedSet].filter((file) => !expected.has(file));
if (unexpected.length > 0) {
  problems.push(
    `collected files git does not track as source tests:\n  ${unexpected.join("\n  ")}`,
  );
}

if (problems.length > 0) {
  console.error(`Test discovery check failed.\n\n${problems.join("\n\n")}\n`);
  process.exit(1);
}

console.log(
  `Test discovery OK — ${collected.length} source test files, each collected exactly once.`,
);
