import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");

test("deploy only accepts successful CI from this repository", () => {
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /github\.event\.workflow_run\.head_repository\.full_name == github\.repository/);
  assert.match(workflow, /TESTED_SHA: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
});

test("deploy refuses stale successful CI and protects exact SHA", () => {
  assert.match(workflow, /git ls-remote origin refs\/heads\/main/);
  assert.match(workflow, /MAIN_SHA.*TESTED_SHA/s);
  assert.match(workflow, /CI run is no longer the current main commit/);
  assert.match(workflow, /CHECKED_OUT_SHA.*TESTED_SHA/s);
});

test("release version is synchronized", () => {
  assert.equal(pkg.version, "0.12.26");
  assert.match(wrangler, /APP_VERSION = "0\.12\.26"/);
});
