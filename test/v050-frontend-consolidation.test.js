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

test("production entry is a single v0.5 source path", () => {
  assert.match(index, /\/styles\.css/);
  assert.match(index, /\/onboarding-v050\.css/);
  assert.match(index, /\/ui-v050\.css/);
  assert.match(index, /\/router-v2\.js/);
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
  ]) assert.doesNotMatch(index, new RegExp(asset.replaceAll(".", "\\.")));
});

test("router has one normal app path and one onboarding path", () => {
  assert.match(router, /await import\("\.\/onboarding-v050\.js"\)/);
  assert.match(router, /await import\("\.\/app\.js"\)/);
  assert.match(router, /1500/);
  assert.match(router, /网络有点慢，数据还在读取/);
});

test("brand and primary navigation are direct source content", () => {
  assert.match(app, /const PRODUCT_NAME = "高三坐标"/);
  assert.match(app, /看见现在的位置，也看见一路的变化/);
  assert.match(app, /data-tab="overview">轨迹/);
  assert.match(app, /data-tab="exams">考试/);
  assert.match(app, /data-tab="sharing">分享/);
  assert.match(app, /data-tab="family">家庭/);
  assert.doesNotMatch(app, /data-tab="settings"/);
});

test("home follows identity, coordinate, change, subjects, history", () => {
  const overview = app.slice(app.indexOf("function renderOverview"), app.indexOf("function renderExamList"));
  for (const phrase of ["coordinate-hero", "和上一次可比考试相比", "变化较明显的科目", "六科", "查看完整轨迹"]) assert.match(overview, new RegExp(phrase));
  assert.doesNotMatch(overview, /变化来自哪里/);
  assert.doesNotMatch(overview, /现在在哪/);
});

test("exam entry keeps technical metadata out of the primary path", () => {
  assert.match(app, /更多考试信息（可选）/);
  assert.match(app, /deriveDataStatus/);
  assert.doesNotMatch(app, /<label>数据状态<\/label>/);
  assert.doesNotMatch(app, /发挥失常|发挥较好/);
  assert.match(app, /正常记录/);
  assert.match(app, /有特殊情况/);
  assert.match(app, /缺考/);
});

test("password change is an in-product secure form, not browser prompt", () => {
  assert.match(app, /function passwordDialog\(/);
  assert.match(app, /当前密码/);
  assert.match(app, /再次输入新密码/);
  assert.match(app, /至少 10 个字符/);
  assert.doesNotMatch(app, /\bprompt\s*\(/);
  assert.doesNotMatch(app, /\balert\s*\(/);
});

test("share composer uses human language and explicit privacy scope", () => {
  for (const phrase of ["想分享什么？", "将分享", "不会分享", "分享链接", "持续更新", "只分享当前内容", "自动失效（可选）", "公开链接（高级）", "生成并复制链接"]) {
    assert.match(app, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(app, /任何拿到这个地址的人都可以查看。不会主动进入搜索，但这不等于私密。/);
});

test("copy contract keeps implementation jargon out of rendered user copy", () => {
  const renderedLiteral = /(?:>|textContent\s*=|innerHTML\s*=)[^\n]*(?:token|noindex|dataStatus|comparisonSeries|comparisonLevel)/gi;
  assert.doesNotMatch(app, renderedLiteral);
  assert.doesNotMatch(onboarding, /高三轨迹|独立家庭/);
  assert.doesNotMatch(app, /家庭账号|变化来自哪里|发挥失常/);
});

test("family and another-household invitation are semantically separated", () => {
  assert.match(app, /家庭里的孩子/);
  assert.match(app, /谁可以登录这个家庭/);
  assert.match(app, /邀请另一户家庭使用高三坐标/);
  assert.match(onboarding, /建立你的家庭空间/);
  assert.match(onboarding, /邀请人也无法查看/);
});

test("draft lifecycle gives visible local-save feedback", () => {
  assert.match(app, /data-draft-state/);
  assert.match(draft, /草稿已保存在本机/);
  assert.match(draft, /已恢复上次未保存的内容/);
  assert.match(draft, /正在保存本机草稿/);
});

test("app root is not a giant live region; status and errors own announcements", () => {
  assert.doesNotMatch(index, /id="app"[^>]*aria-live/);
  assert.match(app, /data-status-region role="status" aria-live="polite"/);
  assert.match(app, /role="alert"/);
});

test("mobile preserves coordinate and exam-list information", () => {
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /\.exam-list-coordinate\s*\{[\s\S]*grid-column:\s*1/);
  assert.doesNotMatch(css, /\.exam-list-coordinate[^}]*display:\s*none/);
  assert.match(css, /\.subject-row\s*\{[\s\S]*grid-template-columns/);
  assert.match(css, /@media \(hover: none\)[\s\S]*min-height:\s*44px/);
});

test("coordinate visual hierarchy is restrained and equal-weight", () => {
  assert.match(css, /\.hero-head h1,[\s\S]*font-size:\s*31px/);
  assert.match(css, /\.coordinate-row > span\s*\{[\s\S]*font-size:\s*24px;[\s\S]*font-weight:\s*650/);
  assert.match(css, /content:\s*"·"/);
  assert.match(css, /rgba\(31,41,46,\.34\)/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.coordinate-row > span \+ span::before\s*\{\s*display:\s*none/);
});

test("version contract is exactly 0.5.0", () => {
  assert.equal(pkg.version, "0.5.0");
  assert.equal(lock.version, "0.5.0");
  assert.equal(lock.packages[""].version, "0.5.0");
  assert.match(wrangler, /APP_VERSION\s*=\s*"0\.5\.0"/);
  assert.match(pkg.scripts.check, /public\/app\.js/);
  assert.match(pkg.scripts.check, /public\/onboarding-v050\.js/);
});
