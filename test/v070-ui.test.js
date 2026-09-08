import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/ui-v070.css", import.meta.url), "utf8");
const plan = await readFile(new URL("../docs/plan/ui-v070-apple-human.md", import.meta.url), "utf8");

test("v0.7 UI source is loaded after the v0.6 source", () => {
  assert.match(index, /ui-v050\.css/);
  assert.match(index, /ui-v070\.css/);
  assert.ok(index.indexOf("ui-v070.css") > index.indexOf("ui-v050.css"));
});

test("privacy signal is calm and rendered in the app source", () => {
  assert.match(app, /privacy-pill/);
  assert.match(app, /仅家庭可见/);
  assert.match(css, /\.privacy-pill\s*\{/);
  assert.doesNotMatch(css, /privacy-pill[^}]*background:\s*var\(--v70-danger/);
});

test("v0.7 foundation protects touch, focus and user motion preferences", () => {
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.tabs\s*\{[\s\S]*position:\s*fixed/);
  assert.match(css, /@media \(hover: none\)[\s\S]*min-height:\s*44px/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(prefers-reduced-transparency: reduce\)/);
  assert.match(css, /:focus-visible/);
  assert.doesNotMatch(css, /transition:\s*all/);
});

test("plan keeps the UI refresh bounded to existing product contracts", () => {
  assert.match(plan, /不改变 v0\.6\.0 数据和安全边界/);
  assert.match(plan, /S1 — 视觉基础与隐私信号/);
  assert.match(plan, /S5 — 版本、全量验证、PR 与生产验收/);
});

test("overview has one clear next action without changing comparison semantics", () => {
  assert.match(app, /function humanChangeSummary\(/);
  assert.match(app, /class="overview-actions"/);
  assert.match(app, /data-primary-action="record-next"/);
  assert.match(app, /记录下一次考试/);
  assert.match(app, /id="deep-trajectory"/);
  assert.match(app, /data-action="open-trajectory"/);
  assert.doesNotMatch(app, /能力提高|能力下降|保证录取/);
});

test("entry errors speak in subject names and preserve recovery cues", () => {
  assert.match(app, /for \(const \[key, label\] of SUBJECTS\)/);
  assert.match(app, /\$\{label\}原始分不能高于/);
  assert.match(app, /\$\{label\}的\$\{scope === "school" \? "学校" : "班级"\}排名不能大于参与人数/);
  assert.match(app, /草稿会自动保存在本机/);
  assert.match(css, /\.draft-state\s*\{/);
  assert.match(css, /\.trash-row\s*\{/);
});

test("sharing and trajectory explain their boundaries before details", () => {
  assert.match(app, /将分享/);
  assert.match(app, /不会分享/);
  assert.match(app, /默认只分享一场/);
  assert.match(app, /只有同类别、口径一致的考试会用于变化结论/);
  assert.match(css, /\.trajectory-boundary-note\s*\{/);
  assert.match(css, /\.share-summary\s*\{/);
});
