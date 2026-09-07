import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/ui-v050.css", import.meta.url), "utf8");
const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("family is a first-class task instead of a generic settings bucket", () => {
  assert.match(app, />家庭<\/button>/);
  assert.doesNotMatch(app, /data-tab="settings"/);
  assert.match(app, /家庭里的孩子/);
  assert.match(app, /谁可以登录这个家庭/);
  assert.match(app, /登录账号/);
  assert.doesNotMatch(app, /家庭账号/);
});

test("family and account actions are rendered directly", () => {
  assert.match(app, /function renderFamily\(/);
  assert.match(app, /修改密码/);
  assert.match(app, /生成 \/ 更换恢复码/);
  assert.match(app, /导出全部数据/);
  assert.match(app, /退出所有设备/);
  assert.match(app, /邀请另一户家庭使用高三坐标/);
  assert.doesNotMatch(index, /family-management\.js/);
});

test("family rows reflow without becoming card soup", () => {
  assert.match(css, /\.member-row,[\s\S]*\.student-row/);
  assert.match(css, /border-bottom:\s*1px solid var\(--v50-line\)/);
});
