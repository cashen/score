import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const ui = await readFile(new URL("../public/ui-v041.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/ui-v041.css", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");

test("v0.4.1 refinement assets are wired after v0.4.0 and syntax checked", () => {
  assert.match(index, /ui-v041\.css/);
  assert.match(index, /ui-v041\.js/);
  assert.ok(index.indexOf("ui-v041.css") > index.indexOf("ui-v040.css"));
  assert.ok(index.indexOf("ui-v041.js") > index.indexOf("ui-v040.js"));
  assert.match(pkg.scripts.check, /public\/ui-v041\.js/);
});

test("sharing removes audience persona as a primary decision", () => {
  assert.match(ui, /想分享什么？/);
  assert.match(ui, /只需要决定分享这一次，还是分享一段轨迹/);
  assert.match(ui, /\[data-v4-audience-step\], \.v3-teacher-preset/);
  assert.match(ui, /v41WatchShareCard\(publicCard, "public"\)/);
  assert.doesNotMatch(ui, /准备给谁看？|>家人<|>老师<|data-v4-audience="family"|data-v4-audience="teacher"/);
  assert.match(css, /\.v4-audience,[\s\S]*\[data-v4-audience-step\],[\s\S]*\.v3-teacher-preset,[\s\S]*\.v3-perspective-bar[\s\S]*display: none !important/);
});

test("default share contract is explicit and privacy summary is human readable", () => {
  assert.match(ui, /displayName: true/);
  assert.match(ui, /graduationYear: false/);
  assert.match(ui, /school: false/);
  assert.match(ui, /className: false/);
  assert.match(ui, /overallScore: true/);
  assert.match(ui, /overallRank: true/);
  assert.match(ui, /subjectScores: true/);
  assert.match(ui, /subjectRanks: true/);
  assert.match(ui, /history: scope === "trajectory"/);
  assert.match(ui, /将分享/);
  assert.match(ui, /不会分享/);
  assert.match(ui, /家庭备注、登录账号、家庭成员和安全信息/);
  assert.match(ui, /修改分享内容/);
  assert.doesNotMatch(ui, /ADMIN_BOOTSTRAP_SECRET|AUTH_PEPPER|SESSION_SECRET/);
});

test("share result uses one coordinate hero and lighter section-row hierarchy", () => {
  assert.match(ui, /v41-current-coordinate/);
  assert.match(ui, /v41-coordinate-primary/);
  assert.match(ui, /v41-change-surface/);
  assert.match(ui, /v41-legacy-comparison-hidden/);
  assert.match(css, /\.public-shell > \.card\.v41-current-coordinate[\s\S]*background: var\(--v41-position-bg\)/);
  assert.match(css, /\.v41-change-surface[\s\S]*background: var\(--v41-change-bg\)/);
  assert.match(css, /\.public-shell \.v3-six-item[\s\S]*border: 0[\s\S]*border-bottom: 1px solid var\(--line\)/);
  assert.match(css, /\.public-shell \.v3-subject-point[\s\S]*border: 0[\s\S]*border-bottom: 1px solid var\(--line\)/);
  assert.match(css, /\.public-shell \.share-comparison-section,[\s\S]*display: none !important/);
});

test("semantic color is restrained and attention is not a red-green grade judgment", () => {
  assert.match(css, /--v41-position-bg: #f2f7f5/);
  assert.match(css, /--v41-change-bg: #f3f6f8/);
  assert.match(css, /--v41-history-bg: #f7f7f5/);
  assert.match(css, /--v41-attention-bg: #fbf7ed/);
  assert.match(css, /\.v3-direction\.is-down[\s\S]*background: var\(--v41-attention-bg\)/);
  assert.doesNotMatch(css, /#f00\b|#ff0000\b|background:\s*red\b|background:\s*green\b/i);
});

test("timeline distinguishes history, currently viewed and latest without full-width cards", () => {
  assert.match(ui, /is-latest/);
  assert.match(ui, /is-viewing/);
  assert.match(ui, /"最新"/);
  assert.match(ui, /"正在查看"/);
  assert.match(ui, /"历史"/);
  assert.match(css, /\.share-timeline-node\.is-latest/);
  assert.match(css, /\.share-timeline-node\.is-viewing:not\(\.is-latest\)/);
  assert.match(css, /min-width: 104px/);
  assert.match(css, /max-width: 138px/);
  assert.match(css, /@media \(max-width: 380px\)[\s\S]*min-width: 96px[\s\S]*max-width: 112px/);
});

test("student-parent persona selector is removed from the visible trajectory reading flow", () => {
  assert.match(ui, /\.v3-perspective-bar, \.v3-teacher-preset/);
  assert.match(ui, /单科历史、六科变化和可比考试/);
  assert.match(ui, /六科变化怎么走/);
  assert.match(ui, /localStorage\.getItem\("score:v030:perspective"\)/);
  assert.match(ui, /localStorage\.removeItem\("score:v030:perspective"\)/);
});

test("v0.4.1 keeps observers bounded and preserves touch/mobile density", () => {
  assert.match(ui, /observer\.observe\(card, \{ childList: true \}\)/);
  assert.match(ui, /observer\.observe\(shell, \{ childList: true \}\)/);
  assert.match(ui, /observe\(v41App, \{ childList: true \}\)/);
  assert.match(ui, /setTimeout\(\(\) => observer\.disconnect\(\), 2500\)/);
  assert.match(ui, /setTimeout\(\(\) => observer\.disconnect\(\), 4000\)/);
  assert.doesNotMatch(ui, /subtree\s*:\s*true/);
  assert.doesNotMatch(ui, /document\.documentElement/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /\.v3-six-item \{ min-height: 50px; \}/);
});

test("release version is exactly 0.4.1 across package lockfile and Worker", () => {
  assert.equal(pkg.version, "0.4.1");
  assert.equal(lock.version, "0.4.1");
  assert.equal(lock.packages[""].version, "0.4.1");
  assert.match(wrangler, /APP_VERSION\s*=\s*"0\.4\.1"/);
});
