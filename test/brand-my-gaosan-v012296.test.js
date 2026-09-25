import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [index, app, onboarding, readme, architecture] = await Promise.all([
  read("public/index.html"),
  read("public/app.js"),
  read("public/onboarding-v050.js"),
  read("README.md"),
  read("docs/ARCHITECTURE.md")
]);

test("current product surfaces use 我的高三", () => {
  for (const source of [index, app, onboarding, readme, architecture]) {
    assert.doesNotMatch(source, /高三坐标/);
    assert.match(source, /我的高三/);
  }
  assert.match(index, /<title>我的高三<\/title>/);
  assert.match(app, /const PRODUCT_NAME = "我的高三"/);
  assert.match(onboarding, /const PRODUCT_NAME = "我的高三"/);
});

test("technical package identity remains stable", async () => {
  const pkg = JSON.parse(await read("package.json"));
  assert.equal(pkg.name, "score-track");
  assert.equal(pkg.version, "0.12.30.0");
});
