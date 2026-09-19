import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("v0.10.2 uses sharing-v2 as the runtime share contract", () => {
  const source = read("src/index.js");
  assert.match(source, /routePrivateSharingV2, routePublicSharingV2/);
  assert.match(source, /routePrivateSharingV2\(request, env, session\)/);
  assert.match(source, /routePublicSharingV2\(request, env\)/);
  assert.doesNotMatch(source, /function handleShareCreate/);
  assert.doesNotMatch(source, /function handleExternalShare/);
  assert.doesNotMatch(source, /handleShareCreate\(/);
  assert.doesNotMatch(source, /handleExternalShare\(/);
});

test("v0.10.2 runtime version is synchronized", () => {
  assert.equal(JSON.parse(read("package.json")).version, "0.10.2");
  assert.match(read("wrangler.toml"), /^APP_VERSION\s*=\s*"0\.10\.2"$/m);
});

test("v0.10.2 share router contains selected-exam, trajectory and preview contracts", () => {
  const source = read("src/sharing-v2.js");
  assert.match(source, /scope === "single"/);
  assert.match(source, /examId/);
  assert.match(source, /shares\/\(secret\|public\)\/\(\[\^\/\]\+\)\/preview/);
  assert.match(source, /future_exams_acknowledgement_required/);
  assert.match(source, /mode === "snapshot"/);
});
