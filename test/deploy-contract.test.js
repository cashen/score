import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lockJson = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const wrangler = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");

test("deployment checks out the exact SHA that passed CI", () => {
  assert.match(workflow, /ref:\s*\$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(workflow, /TESTED_SHA:\s*\$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(workflow, /git rev-parse HEAD/);
});

test("deployment attests the expected runtime version instead of accepting HTTP 200", () => {
  assert.match(workflow, /EXPECTED_VERSION/);
  assert.match(workflow, /APP_VERSION/);
  assert.match(workflow, /payload\.appVersion === expected/);
  assert.match(workflow, /Production never converged to appVersion/);
  assert.match(workflow, /cache-control/);
});

test("deployment still preserves required Worker secret hardening", () => {
  assert.match(workflow, /SCORE_SESSION_SECRET/);
  assert.match(workflow, /SCORE_AUTH_PEPPER/);
  assert.match(workflow, /SCORE_ADMIN_BOOTSTRAP_SECRET/);
  assert.match(workflow, /--secrets-file \.runtime-secrets\.json/);
  assert.doesNotMatch(workflow, /--keep-vars/);
});

test("release version is synchronized across package and Worker contracts", () => {
  const escapedVersion = packageJson.version.replaceAll(".", "\\.");
  assert.equal(lockJson.version, packageJson.version);
  assert.equal(lockJson.packages[""].version, packageJson.version);
  assert.match(wrangler, new RegExp(`^APP_VERSION = "${escapedVersion}"import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lockJson = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const wrangler = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");

test("deployment checks out the exact SHA that passed CI", () => {
  assert.match(workflow, /ref:\s*\$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(workflow, /TESTED_SHA:\s*\$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(workflow, /git rev-parse HEAD/);
});

test("deployment attests the expected runtime version instead of accepting HTTP 200", () => {
  assert.match(workflow, /EXPECTED_VERSION/);
  assert.match(workflow, /APP_VERSION/);
  assert.match(workflow, /payload\.appVersion === expected/);
  assert.match(workflow, /Production never converged to appVersion/);
  assert.match(workflow, /cache-control/);
});

test("deployment still preserves required Worker secret hardening", () => {
  assert.match(workflow, /SCORE_SESSION_SECRET/);
  assert.match(workflow, /SCORE_AUTH_PEPPER/);
  assert.match(workflow, /SCORE_ADMIN_BOOTSTRAP_SECRET/);
  assert.match(workflow, /--secrets-file \.runtime-secrets\.json/);
  assert.doesNotMatch(workflow, /--keep-vars/);
});

test("release version is synchronized across package and Worker contracts", () => {
  const escapedVersion = packageJson.version.replaceAll(".", "\\.");
  assert.equal(lockJson.version, packageJson.version);
  assert.equal(lockJson.packages[""].version, packageJson.version);
  , "m"));\n  assert.match(changelog, new RegExp(`^## ${escapedVersion}$`, "m"));
});
