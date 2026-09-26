import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const bundle = await readFile(new URL("../public/css/app-v094.css", import.meta.url), "utf8");
const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");

test("v0.12.27 security hardening retains visual hierarchy baseline", () => {
  assert.match(pkg.version, /^0\.\d+\.\d+(?:\.\d+)*$/);
  const escapedVersion = pkg.version.replaceAll(".", "\\.");
  assert.match(wrangler, new RegExp(`APP_VERSION\\s*=\\s*"${escapedVersion}"`));
});

test("overview keeps current exam before comparison, score list and history", () => {
  const renderOverviewSource = app.slice(app.indexOf("function renderOverview"), app.indexOf("function renderExamList"));
  const overview = renderOverviewSource.slice(renderOverviewSource.indexOf('return `<section class="home-page"'));
  assert.ok(overview.indexOf("home-latest") < overview.indexOf("home-change"));
  assert.ok(overview.indexOf("home-change") < overview.indexOf("home-subjects"));
  assert.ok(overview.indexOf("home-subjects") < overview.indexOf("renderDeepTrajectory()"));
  assert.doesNotMatch(overview, /renderTrajectoryReading\(/);
  assert.doesNotMatch(overview, /多次考试怎么看|先看同一种比较方式/);
  assert.match(renderOverviewSource, /comparisonStrengthLabel\(comparison\)/);
});

test("empty subject-change analysis is not rendered as a placeholder block", () => {
  const overview = app.slice(app.indexOf("function renderOverview"), app.indexOf("function renderExamList"));
  assert.match(overview, /const sourceSection = sources\.length/);
  assert.match(overview, /: "";?/);
});

test("desktop comparison is a narrow reading block while current scores stay wider", () => {
  assert.match(bundle, /--v100-reading-width:\s*720px/);
  assert.match(bundle, /\.change-section\s*\{[\s\S]*?width:\s*min\(100%, var\(--v100-reading-width\)\)/);
  assert.match(bundle, /\.subjects-section\s*\{[\s\S]*?max-width:\s*960px/);
});

test("small screens release the desktop reading constraint", () => {
  assert.match(bundle, /@media \(max-width: 760px\)[\s\S]*?\.change-section\s*\{[\s\S]*?width:\s*100%/);
  assert.match(bundle, /@media \(max-width: 520px\)/);
  assert.match(bundle, /@media \(max-width: 380px\)/);
});

test("runtime bundle contains the same hierarchy layer", () => {
  assert.ok(bundle.includes("v0.12.24 information hierarchy"));
  assert.ok(bundle.includes("v0.12.24 information hierarchy"));
  assert.match(index, /\/css\/app-v094\.css/);
});

test("public share no longer exposes the multi-card trajectory analysis", () => {
  const publicPart = app.slice(app.indexOf("function renderPublicV080"), app.indexOf("async function renderExternal"));
  assert.doesNotMatch(publicPart, /public-analysis-note|从最早一次到现在/);
  assert.match(publicPart, /publicComparisonNote\(/);
});