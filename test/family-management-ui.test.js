import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const ui = await readFile(new URL("../public/family-management.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/family-management.css", import.meta.url), "utf8");
const familyApi = await readFile(new URL("../src/family.js", import.meta.url), "utf8");

test("family management assets are loaded by the private app shell", () => {
  assert.match(index, /family-management\.css/);
  assert.match(index, /family-management\.js/);
  assert.match(css, /\.family-member-row/);
  assert.match(css, /@media \(max-width: 620px\)/);
});

test("settings UI exposes human member and child flows without bootstrap secret", () => {
  assert.match(ui, /家庭成员/);
  assert.match(ui, /创建家庭成员/);
  assert.match(ui, /添加孩子/);
  assert.match(ui, /这里不是创建新的独立家庭/);
  assert.match(ui, /autocomplete="new-password"/);
  assert.doesNotMatch(ui, /ADMIN_BOOTSTRAP_SECRET/);
});

test("viewer UI is explicitly read-only and member controls are owner-only", () => {
  assert.match(ui, /me\.member\.role === "viewer"/);
  assert.match(ui, /control\.disabled = true/);
  assert.match(ui, /me\.member\.role === "owner"/);
});

test("family API sanitizes member responses and invalidates sessions on access change", () => {
  assert.match(familyApi, /function memberSummary/);
  assert.doesNotMatch(familyApi.match(/function memberSummary[\s\S]*?\n\}/)?.[0] || "", /password/);
  assert.match(familyApi, /sessionVersion: changed \? \(target\.sessionVersion \|\| 1\) \+ 1/);
  assert.match(familyApi, /只有家庭管理员可以管理登录成员/);
});
