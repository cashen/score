import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../public/css/app-v094.css", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");
const router = await readFile(new URL("../public/router-v2.js", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

test("v0.9.4 has one versioned runtime stylesheet entry", () => {
  assert.match(css, /--score-ink/);
  assert.equal((app.match(/<link[^>]+stylesheet/g) || []).length, 0);
  assert.match(router, /app\.js/);
});

test("coordinate visual hierarchy is restrained and equal-weight", () => {
  assert.match(css, /\.hero-head h1,\s*\.public-coordinate h1\s*\{[^}]*font-size:\s*31px/);
  assert.match(css, /\.coordinate-row > span\s*\{[^}]*font-size:\s*24px;[^}]*font-weight:\s*650/);
  assert.ok(css.includes('content: "·"'));
  assert.match(css, /rgba\(31,\s*41,\s*46,\s*\.34\)/);
  assert.match(css, /@media \(max-width: 760px\).*\.coordinate-row > span \+ span::before\s*\{\s*display:\s*none/);
});

test("version contract is exactly 0.10.0", () => {
  assert.equal(pkg.version, "0.10.0");
  assert.equal(lock.version, "0.10.0");
  assert.equal(lock.packages[""].version, "0.10.0");
  assert.match(wrangler, /APP_VERSION\s*=\s*"0\.10\.0"/);
  assert.match(pkg.scripts.check, /public\/app\.js/);
  assert.match(pkg.scripts.check, /public\/onboarding-v050\.js/);
});
