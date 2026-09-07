import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const ui = await readFile(new URL("../public/ui-v040.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/ui-v040.css", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");

test("v0.4 consolidated UI assets are wired last and syntax-checked", () => {
  assert.match(index, /ui-v040\.css/);
  assert.match(index, /ui-v040\.js/);
  assert.ok(index.indexOf("ui-v040.css") > index.indexOf("trajectory-v3.css"));
  assert.ok(index.indexOf("ui-v040.js") > index.indexOf("trajectory-v3.js"));
  assert.match(pkg.scripts.check, /public\/ui-v040\.js/);
});

test("homepage hierarchy is position first rather than score first", () => {
  assert.match(ui, /现在在哪/);
  assert.match(ui, /最近变化/);
  assert.match(ui, /变化来自哪里/);
  assert.match(ui, /className = "v4-overview"/);
  assert.match(ui, /class="v4-position"/);
  assert.match(ui, /v4HideLegacyOverview/);
  assert.match(ui, /v4-duplicate-summary/);
  assert.match(css, /\.v4-position[\s\S]*font-size: clamp\(34px, 5vw, 54px\)/);
  assert.match(css, /\.v4-legacy-hidden,[\s\S]*display: none !important/);
});

test("trajectory deep dive is distinct from the overview and mobile six-subject scan is compact", () => {
  assert.match(ui, /深入看轨迹/);
  assert.match(ui, /单科历史、六科变化和不同阅读视角/);
  assert.match(css, /\.v4-deep-dive/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*\.v3-six-item[\s\S]*grid-template-columns: 70px minmax\(0, 1fr\) auto/);
  assert.match(css, /\.v4-deep-dive \.v3-subject-history-scroll[\s\S]*grid-template-columns: repeat\(2/);
});

test("normal sharing flow is scope then audience then generate-and-copy with advanced fields secondary", () => {
  assert.match(ui, /想分享什么？/);
  assert.match(ui, /准备给谁看？/);
  assert.match(ui, /家人/);
  assert.match(ui, /老师/);
  assert.match(ui, /自定义/);
  assert.match(ui, /生成并复制链接/);
  assert.match(ui, /修改分享内容与有效期/);
  assert.match(ui, /默认隐藏学校、班级、家庭备注和账号信息/);
  assert.match(ui, /家庭备注和账号信息始终不会输出/);
  assert.doesNotMatch(ui, /ADMIN_BOOTSTRAP_SECRET|AUTH_PEPPER|SESSION_SECRET/);
});

test("exam entry uses human comparison semantics and keeps joint rank in overall position", () => {
  assert.match(ui, /考试范围（可选）/);
  assert.match(ui, /更多比较信息（可选）/);
  assert.match(ui, /属于同一个考试系列（可选）/);
  assert.match(ui, /data-v4-joint-rank/);
  assert.match(ui, /type\?\.value === "joint"/);
  assert.match(ui, /rank\.disabled = !visible/);
  assert.match(ui, /people\.disabled = !visible/);
});

test("independent-family onboarding is staged and recovery code requires explicit acknowledgement", () => {
  assert.match(ui, /建立家庭/);
  assert.match(ui, /创建登录账号/);
  assert.match(ui, /孩子资料/);
  assert.match(ui, /1 \/ 3/);
  assert.match(ui, /我已经把恢复码保存到安全的位置/);
  assert.match(ui, /finish\.disabled = true/);
});

test("design system and responsive acceptance encode touch and 360px-safe behavior", () => {
  assert.match(css, /--radius-sm: 10px/);
  assert.match(css, /--radius-md: 14px/);
  assert.match(css, /--radius-lg: 20px/);
  assert.match(css, /@media \(hover: none\)/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /@media \(max-width: 380px\)/);
  assert.match(css, /@media \(max-width: 620px\)/);
});

test("v0.4 coordinator only uses top-level or bounded local childList observers", () => {
  assert.match(ui, /observe\(v4App, \{ childList: true \}\)/);
  assert.match(ui, /observer\.observe\(main, \{ childList: true \}\)/);
  assert.match(ui, /observer\.observe\(form, \{ childList: true \}\)/);
  assert.match(ui, /observe\(document\.body, \{ childList: true \}\)/);
  assert.doesNotMatch(ui, /subtree\s*:\s*true/);
  assert.doesNotMatch(ui, /document\.documentElement/);
  assert.match(ui, /setTimeout\(\(\) => observer\.disconnect\(\), 2500\)/);
});

test("release version is exactly 0.4.0 across package lockfile and Worker", () => {
  assert.equal(pkg.version, "0.4.0");
  assert.equal(lock.version, "0.4.0");
  assert.equal(lock.packages[""].version, "0.4.0");
  assert.match(wrangler, /APP_VERSION\s*=\s*"0\.4\.0"/);
});
