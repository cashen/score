import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../public/ui-v050.css", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("identity stays larger than peer coordinate metrics", () => {
  assert.match(css, /\.hero-head h1,[\s\S]*\.public-coordinate h1[\s\S]*font-size:\s*31px/);
  assert.match(css, /\.coordinate-row > span\s*\{[\s\S]*font-size:\s*24px/);
});

test("mobile coordinate typography remains compact", () => {
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.coordinate-row > span\s*\{\s*font-size:\s*20px/);
  assert.match(css, /@media \(max-width: 380px\)[\s\S]*\.coordinate-row > span\s*\{\s*font-size:\s*19px/);
});

test("coordinate copy is semantic, not a ranking poster", () => {
  assert.match(app, /compactRank\("校"/);
  assert.match(app, /compactRank\("班"/);
  assert.equal(pkg.version, "0.5.0");
});
