import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");

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
  assert.match(workflow, /--keep-vars --secrets-file \.runtime-secrets\.json/);
});