import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("normal sharing asks what to share instead of who the viewer is", () => {
  assert.match(app, /想分享什么？/);
  assert.match(app, /这一次考试/);
  assert.match(app, /高三轨迹/);
  assert.doesNotMatch(app, /准备给谁看|家人查看|老师查看|自定义/);
});

test("share preview explicitly states included and excluded information", () => {
  assert.match(app, /将分享/);
  assert.match(app, /不会分享/);
  assert.match(app, /家庭备注、登录账号、家庭成员和安全信息/);
  assert.match(app, /生成并复制链接/);
});

test("public sharing uses human privacy language", () => {
  assert.match(app, /公开链接（高级）/);
  assert.match(app, /任何拿到这个地址的人都可以查看。不会主动进入搜索，但这不等于私密。/);
  // Internal token/robots identifiers may exist in implementation. What must not exist
  // is rendered copy that literally presents those engineering terms to the user.
  assert.doesNotMatch(app, />\s*(?:token|noindex)\s*</i);
});

test("share UI is source rendered, not v0.4 patched", () => {
  assert.doesNotMatch(index, /ui-v041\.(?:css|js)/);
  assert.match(app, /function renderSharing\(/);
});
