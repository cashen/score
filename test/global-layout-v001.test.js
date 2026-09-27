import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("public/css/app-v094.css", "utf8");
const index = fs.readFileSync("public/index.html", "utf8");

test("v0.14.4 page families share the centered reading axis", () => {
  const declarations = [
    /\.page-heading\s*\{[\s\S]*?margin-inline:\s*auto/,
    /\.share-layout[\s\S]*?margin-inline:\s*auto/,
    /\.family-layout[\s\S]*?margin-inline:\s*auto/,
    /\.exam-list[\s\S]*?margin-inline:\s*auto/,
    /\.current-shares[\s\S]*?margin-inline:\s*auto/,
    /\.full-timeline-list[\s\S]*?margin-inline:\s*auto/,
    /\.trajectory-view\s*\{[\s\S]*?margin-inline:\s*auto/
  ];
  for (const pattern of declarations) assert.match(css, pattern);
  assert.match(css, /\.exam-dialog \.exam-section[\s\S]*?margin-inline:\s*auto/);
});

test("v0.14.4 does not add another general-purpose stylesheet layer", () => {
  assert.match(index, /ui-foundation-v001\.css/);
  assert.match(index, /share-eink-v001\.css/);
  assert.doesNotMatch(index, /layout-v001\.css/);
});
