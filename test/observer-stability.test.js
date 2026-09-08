import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const router = await readFile(new URL("../public/router-v2.js", import.meta.url), "utf8");
const draft = await readFile(new URL("../public/draft.js", import.meta.url), "utf8");

test("production entry no longer loads DOM-rewrite enhancer chain", () => {
  for (const asset of ["brand-v021", "exam-humanize", "family-management.js", "trajectory-v2.js", "trajectory-v3.js", "ui-v040.js", "ui-v041.js", "ui-v042.js"]) {
    assert.doesNotMatch(index, new RegExp(asset.replace(".", "\\.")));
  }
  assert.match(index, /router-v2\.js/);
  assert.match(router, /import\("\.\/app\.js"\)/);
});

test("active app uses no MutationObserver for UI reconstruction", () => {
  assert.doesNotMatch(app, /MutationObserver/);
  assert.doesNotMatch(router, /MutationObserver/);
});

test("draft observer is lifecycle-only and never broad subtree scanning", () => {
  assert.match(draft, /new MutationObserver\(scanDialogLifecycle\)/);
  assert.match(draft, /observer\.observe\(document\.body, \{ childList: true \}\)/);
  assert.doesNotMatch(draft, /subtree\s*:\s*true/);
});
