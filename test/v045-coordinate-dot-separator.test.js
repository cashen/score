import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../public/ui-v050.css", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("desktop peer coordinates use a quiet neutral middle dot", () => {
  assert.match(css, /\.coordinate-row > span \+ span::before\s*\{[\s\S]*content:\s*"·"/);
  assert.match(css, /color:\s*rgba\(31,41,46,\.34\)/);
  assert.match(css, /font-weight:\s*400/);
});

test("mobile removes separator punctuation so wrapping never begins with a dot", () => {
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.coordinate-row > span \+ span::before\s*\{\s*display:\s*none/);
});

test("separator contract is carried forward by v0.5", () => {
  assert.equal(pkg.version, "0.6.0");
});
