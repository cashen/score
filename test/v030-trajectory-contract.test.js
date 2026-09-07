import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const v3 = await readFile(new URL("../public/trajectory-v3.js", import.meta.url), "utf8");
const coord = await readFile(new URL("../public/trajectory-v3-coordination.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/trajectory-v3.css", import.meta.url), "utf8");
const model = await readFile(new URL("../src/lib/model.js", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");

test("v0.3 multidimensional trajectory assets are wired into the shell", () => {
  assert.match(index, /trajectory-v3\.css/);
  assert.match(index, /trajectory-v3\.js/);
  assert.match(index, /trajectory-v3-coordination\.js/);
  assert.match(pkg.scripts.check, /public\/trajectory-v3\.js/);
  assert.match(pkg.scripts.check, /public\/trajectory-v3-coordination\.js/);
});

test("single-subject history supports all six subjects and position-first comparison", () => {
  for (const label of ["语文", "数学", "英语", "物理", "化学", "生物"]) assert.match(v3, new RegExp(label));
  assert.match(v3, /data-v3-subject/);
  assert.match(v3, /学校位置/);
  assert.match(v3, /班级位置/);
  assert.match(v3, /当前分数/);
  assert.match(v3, /总人数未填，仅看名次/);
  assert.match(v3, /不同考试难度不同，单看分数不能直接判断相对位置变化/);
});

test("six-subject map and student-parent perspectives use restrained copy", () => {
  assert.match(v3, /六科变化/);
  assert.match(v3, /学生：我在哪、哪科在变/);
  assert.match(v3, /家长：发生了什么、什么值得留意/);
  assert.match(v3, /值得留意/);
  assert.match(v3, /不用单次考试下结论/);
  assert.match(v3, /只有分数时不把变化包装成“进步\/退步”/);
  assert.doesNotMatch(v3, /严重退步|必须干预|高考预测|录取概率/);
});

test("trajectory share exposes overview subject comparison and keeps the exam timeline separate", () => {
  assert.match(v3, /data-v3-view="overview"/);
  assert.match(v3, />总体</);
  assert.match(v3, />单科</);
  assert.match(v3, />六科对比</);
  assert.match(v3, /#subject-/);
  assert.match(v3, /#compare/);
  assert.match(index, /share-timeline-v2\.js/);
});

test("teacher preset is privacy-scoped and survives async v2 share control mounting", () => {
  assert.match(v3, /给老师看/);
  assert.match(v3, /老师查看预设已应用/);
  assert.match(v3, /默认不带学校、班级身份信息/);
  assert.match(v3, /家庭备注永不分享/);
  assert.match(v3, /\["school", "className"\]/);
  assert.match(coord, /v3CoordWatchShareCard/);
  assert.match(coord, /observer\.observe\(card, \{ childList: true \}\)/);
  assert.match(coord, /v3CoordAttachTeacherPreset/);
  assert.doesNotMatch(v3 + coord, /ADMIN_BOOTSTRAP_SECRET|AUTH_PEPPER|SESSION_SECRET/);
});

test("exam comparability is optional, backwards compatible and sent through the normal exam API", () => {
  assert.match(v3, /可比组（可不填）/);
  assert.match(v3, /2027届辽宁模考/);
  assert.match(v3, /comparisonSeries/);
  assert.match(v3, /comparisonLevel/);
  assert.match(v3, /body\.comparison = \{ series, level: level \|\| null \}/);
  assert.match(v3, /优先比较同一可比组/);
  assert.match(v3, /考试口径可能不同/);
  assert.match(model, /COMPARISON_LEVELS/);
  assert.match(model, /input\.comparison === undefined/);
  assert.match(model, /comparison: exam\.comparison/);
  assert.match(coord, /subjectEditor\.insertAdjacentElement\("beforebegin", block\)/);
  assert.match(coord, /form\.dataset\.v3Comparison = "1"/);
});

test("v0.3 interaction remains Android-friendly and never reintroduces broad DOM observation", () => {
  assert.match(css, /overflow-x: auto/);
  assert.match(css, /-webkit-overflow-scrolling: touch/);
  assert.match(css, /@media \(hover: none\)/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(v3, /observe\(v3App, \{ childList: true \}\)/);
  assert.match(v3, /observe\(v3Body, \{ childList: true \}\)/);
  assert.match(coord, /observe\(v3CoordApp, \{ childList: true \}\)/);
  assert.match(coord, /observe\(document\.body, \{ childList: true \}\)/);
  assert.doesNotMatch(v3 + coord, /subtree\s*:\s*true/);
  assert.doesNotMatch(v3 + coord, /document\.documentElement/);
});

test("v0.3 suppresses late legacy trajectory summaries without broad observation", () => {
  assert.match(coord, /v3CoordRemoveLegacySummary/);
  assert.match(coord, /root\.querySelectorAll\("\[data-trajectory-v2\]"\)/);
  assert.match(coord, /observer\.observe\(root, \{ childList: true \}\)/);
  assert.match(coord, /setTimeout\(\(\) => observer\.disconnect\(\), 2000\)/);
});

test("release version is exactly 0.3.0 across package lockfile and Worker", () => {
  assert.equal(pkg.version, "0.3.0");
  assert.equal(lock.version, "0.3.0");
  assert.equal(lock.packages[""].version, "0.3.0");
  assert.match(wrangler, /APP_VERSION\s*=\s*"0\.3\.0"/);
});
