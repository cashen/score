import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/ui-v050.css", import.meta.url), "utf8");
const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("school rank, class rank and score are rendered in one peer coordinate row", () => {
  assert.match(app, /function coordinateRow\(/);
  assert.match(app, /coordinateItems/);
  assert.match(css, /\.coordinate-row,[\s\S]*display:\s*flex/);
  assert.match(css, /flex-wrap:\s*wrap/);
});

test("mobile wrapping is natural rather than forced nowrap", () => {
  assert.doesNotMatch(css, /\.coordinate-row[^}]*white-space:\s*nowrap/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.coordinate-row\s*\{[\s\S]*column-gap:\s*12px/);
});

test("v0.5 entry owns coordinate behavior directly", () => {
  assert.match(index, /ui-v050\.css/);
  assert.doesNotMatch(index, /ui-v042\.css/);
});
