import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../public/ui-v100-share-eink.css", import.meta.url), "utf8");

test("v0.10 E-ink layer is linked after the existing share layer", () => {
  assert.ok(index.indexOf("ui-v100-share-eink.css") > index.indexOf("ui-v081-share-ink.css"));
  assert.match(css, /\.share-ink-root/);
  assert.match(css, /\.public-shell\.ink-share/);
  assert.match(css, /--eink-paper:\s*#f1f0ea/i);
  assert.match(css, /--eink-page:\s*#faf9f4/i);
  assert.match(css, /--eink-text:\s*#242525/i);
  assert.match(css, /--eink-muted:\s*#6e716f/i);
  assert.match(css, /--eink-rule:\s*#c9c9c2/i);
  assert.match(css, /--eink-rule-strong:\s*#858781/i);
  assert.match(css, /--eink-missing:\s*#8d867a/i);
  assert.match(css, /--eink-special:\s*#6e6868/i);
});

test("E-ink treatment stays quiet and scoped", () => {
  assert.doesNotMatch(css, /linear-gradient|radial-gradient|box-shadow\s*:/i);
  assert.doesNotMatch(css, /#[0-9a-f]{3,6}\s*!?\s*\/\s*\d/i);
  assert.doesNotMatch(css, /url\(/i);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(prefers-reduced-transparency: reduce\)/);
  assert.match(css, /@media \(prefers-contrast: more\)/);
  assert.match(css, /min-height:\s*44px/);
});

test("share report header keeps mode, future-update and privacy boundaries explicit", () => {
  assert.match(app, /class="share-report-header"/);
  assert.match(app, /分享报告/);
  assert.match(app, /class="share-report-context"/);
  assert.match(app, /includesFutureExams/);
  assert.match(app, /此页面由家庭主动分享/);
  assert.match(app, /class="public-shell ink-share"/);
  assert.match(app, /data-share-view=/);
  assert.match(app, /data-exam-count=/);
});
