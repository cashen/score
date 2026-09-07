import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const router = await readFile(new URL("../public/router-v2.js", import.meta.url), "utf8");
const onboarding = await readFile(new URL("../public/onboarding-v2.js", import.meta.url), "utf8");
const trajectory = await readFile(new URL("../public/trajectory-v2.js", import.meta.url), "utf8");
const sharing = await readFile(new URL("../src/sharing-v2.js", import.meta.url), "utf8");
const worker = await readFile(new URL("../src/v020.js", import.meta.url), "utf8");
const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");

test("v0.2.0 assets are actually wired into the shell", () => {
  assert.match(index, /router-v2\.js/);
  assert.match(index, /trajectory-v2\.js/);
  assert.match(index, /trajectory-v2\.css/);
  assert.match(index, /onboarding-v2\.js/);
  assert.match(index, /onboarding-v2\.css/);
  assert.doesNotMatch(index, /src="\/app\.js"/);
});

test("onboarding routes do not race with the private app", () => {
  assert.match(router, /\/forgot/);
  assert.match(router, /\/join\//);
  assert.match(router, /\/recover\//);
  assert.match(router, /if \(!onboarding\) import\("\.\/app\.js"\)/);
});

test("trajectory sharing explicitly separates one exam from the whole trajectory", () => {
  assert.match(trajectory, /分享高三轨迹/);
  assert.match(trajectory, /分享某一次考试/);
  assert.match(trajectory, /body\.examId/);
  assert.match(sharing, /scope === "single"/);
  assert.match(sharing, /scope === "trajectory"/);
  assert.match(sharing, /examId/);
  assert.match(sharing, /schemaVersion: 2/);
});

test("trajectory copy follows product hierarchy: position, change, subject cause", () => {
  assert.match(trajectory, /孩子现在在哪/);
  assert.match(trajectory, /最近有没有变化/);
  assert.match(trajectory, /变化来自哪一科/);
  assert.match(trajectory, /不能推断百分位/);
});

test("invitation and recovery UI never asks for bootstrap/admin secrets", () => {
  assert.doesNotMatch(onboarding, /ADMIN_BOOTSTRAP_SECRET|SCORE_ADMIN_BOOTSTRAP_SECRET/);
  assert.match(onboarding, /\/api\/admin\/invitations/);
  assert.match(onboarding, /\/api\/recovery\/code/);
  assert.match(onboarding, /\/api\/admin\/recovery-links/);
  assert.match(onboarding, /恢复码只显示这一次|新的恢复码只显示一次/);
});

test("deployment entrypoint and runtime version are v0.2.0", () => {
  assert.match(wrangler, /main\s*=\s*"src\/v020\.js"/);
  assert.match(wrangler, /APP_VERSION\s*=\s*"0\.2\.0"/);
  assert.match(worker, /routePublicOnboarding/);
  assert.match(worker, /routePrivateOnboarding/);
  assert.match(worker, /routePublicSharingV2/);
  assert.match(worker, /routePrivateSharingV2/);
});
