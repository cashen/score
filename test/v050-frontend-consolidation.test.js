import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const router = await readFile(new URL("../public/router-v2.js", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const draft = await readFile(new URL("../public/draft.js", import.meta.url), "utf8");
const onboarding = await readFile(new URL("../public/onboarding-v050.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/ui-v050.css", import.meta.url), "utf8");
const onboardingCss = await readFile(new URL("../public/onboarding-v050.css", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");

const activeSources = [index, router, app, onboarding, css, onboardingCss].join("\n");
const cssFlat = css.replace(/\s+/g, " ");

function expectAll(source, values) {
  for (const value of values) assert.ok(source.includes(value), `missing contract: ${value}`);
}

test("production entry is a single v0.5 source path", () => {
  expectAll(index, ["/styles.css", "/onboarding-v050.css", "/ui-v050.css", "/router-v2.js"]);
  for (const asset of [
    "brand-v021.js",
    "exam-humanize.js",
    "family-management.js",
    "trajectory-v2.js",
    "trajectory-v3.js",
    "ui-v040.js",
    "ui-v041.js",
    "ui-v042.js",
    "ui-v040.css",
    "ui-v041.css",
    "ui-v042.css",
    "onboarding-v2.js",
    "onboarding-v2.css"
  ]) assert.ok(!index.includes(asset), `legacy asset still active: ${asset}`);
});

test("router has one normal app path and one onboarding path", () => {
  expectAll(router, [
    'await import("./onboarding-v050.js")',
    'await import("./app.js")',
    "1500",
    "网络有点慢，数据还在读取"
  ]);
});

test("brand and primary navigation are direct source content", () => {
  expectAll(app, [
    'const PRODUCT_NAME = "高三坐标"',
    "看见现在的位置，也看见一路的变化",
    'data-tab="overview">轨迹',
    'data-tab="exams">考试',
    'data-tab="sharing">分享',
    'data-tab="family">家庭'
  ]);
  assert.ok(!app.includes('data-tab="settings"'));
});

test("home follows identity, coordinate, change, subjects, history", () => {
  const overview = app.slice(app.indexOf("function renderOverview"), app.indexOf("function renderExamList"));
  expectAll(overview, ["coordinate-hero", "和上一次可比考试相比", "变化较明显的科目", "六科", "renderDeepTrajectory()"]);
  assert.ok(app.includes("查看完整轨迹"));
  assert.ok(!overview.includes("变化来自哪里"));
  assert.ok(!overview.includes("现在在哪"));
});

test("exam entry keeps technical metadata out of the primary path", () => {
  expectAll(app, ["更多考试信息（可选）", "deriveDataStatus", "正常记录", "有特殊情况", "缺考"]);
  assert.ok(!app.includes("<label>数据状态</label>"));
  assert.doesNotMatch(app, /发挥失常|发挥较好/);
});

test("password change is an in-product secure form, not browser prompt", () => {
  expectAll(app, ["function passwordDialog(", "当前密码", "再次输入新密码", "至少 10 个字符"]);
  assert.doesNotMatch(app, /\bprompt\s*\(/);
  assert.doesNotMatch(app, /\balert\s*\(/);
});

test("share composer uses human language and explicit privacy scope", () => {
  expectAll(app, [
    "想分享什么？",
    "将分享",
    "不会分享",
    "分享链接",
    "持续更新",
    "只分享当前内容",
    "自动失效（可选）",
    "公开链接（高级）",
    "生成并复制链接",
    "任何拿到这个地址的人都可以查看。不会主动进入搜索，但这不等于私密。"
  ]);
});

test("copy contract keeps implementation jargon out of rendered user copy", () => {
  // Internal identifiers may still use words such as token; the contract is that
  // ordinary rendered copy must not expose those implementation terms to users.
  for (const term of ["token", "noindex", "dataStatus", "comparisonSeries", "comparisonLevel"]) {
    const visibleTag = new RegExp(`>\\s*${term}\\s*<`, "i");
    assert.doesNotMatch(activeSources, visibleTag);
  }
  assert.doesNotMatch(onboarding, /高三轨迹|独立家庭/);
  assert.doesNotMatch(app, /家庭账号|变化来自哪里|发挥失常/);
});

test("family and another-household invitation are semantically separated", () => {
  expectAll(app, ["家庭里的孩子", "谁可以登录这个家庭", "邀请另一户家庭使用高三坐标"]);
  expectAll(onboarding, ["建立你的家庭空间", "邀请人也无法查看"]);
});

test("draft lifecycle gives visible local-save feedback", () => {
  expectAll(app, ["data-draft-state"]);
  expectAll(draft, ["草稿已保存在本机", "已恢复上次未保存的内容", "正在保存本机草稿"]);
});

test("app root is not a giant live region; status and errors own announcements", () => {
  assert.doesNotMatch(index, /id="app"[^>]*aria-live/);
  expectAll(app, ['data-status-region role="status" aria-live="polite"', 'role="alert"']);
});

test("mobile preserves coordinate and exam-list information", () => {
  assert.ok(cssFlat.includes("@media (max-width: 760px)"));
  assert.match(cssFlat, /\.exam-list-coordinate\s*\{[^}]*grid-column:\s*1(?:\s*\/\s*[^;}]*)?/);
  assert.doesNotMatch(cssFlat, /\.exam-list-coordinate\s*\{[^}]*display:\s*none/);
  assert.match(cssFlat, /\.subject-row\s*\{[^}]*grid-template-columns:/);
  assert.match(cssFlat, /@media \(hover: none\).*min-height:\s*44px/);
});

test("coordinate visual hierarchy is restrained and equal-weight", () => {
  assert.match(cssFlat, /\.hero-head h1,\s*\.public-coordinate h1\s*\{[^}]*font-size:\s*31px/);
  assert.match(cssFlat, /\.coordinate-row > span\s*\{[^}]*font-size:\s*24px;[^}]*font-weight:\s*650/);
  assert.ok(css.includes('content: "·"'));
  assert.match(cssFlat, /rgba\(31,\s*41,\s*46,\s*\.34\)/);
  assert.match(cssFlat, /@media \(max-width: 760px\).*\.coordinate-row > span \+ span::before\s*\{\s*display:\s*none/);
});

test("version contract is exactly 0.10.0", () => {
  assert.equal(pkg.version, "0.10.0");
  assert.equal(lock.version, "0.10.0");
  assert.equal(lock.packages[""].version, "0.10.0");
  assert.match(wrangler, /APP_VERSION\s*=\s*"0\.10\.0"/);
  assert.match(pkg.scripts.check, /public\/app\.js/);
  assert.match(pkg.scripts.check, /public\/onboarding-v050\.js/);
});
