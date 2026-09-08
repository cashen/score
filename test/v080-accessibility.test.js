import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../public/ui-v080.css", import.meta.url), "utf8");

test("v0.8 visual layer is loaded after the existing v0.7 layer", () => {
  assert.ok(index.indexOf("ui-v080.css") > index.indexOf("ui-v070.css"));
});

test("v0.8 views preserve touch and reduced-motion contracts", () => {
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /transition:\s*all/);
});
