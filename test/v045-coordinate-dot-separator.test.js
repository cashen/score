import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../public/ui-v042.css", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");

test("coordinate separators are neutral middle dots instead of structural rules", () => {
  assert.match(css, /--v45-separator:\s*rgba\(31, 41, 46, \.34\)/);
  assert.match(css, /\.v44-coordinate-item \+ \.v44-coordinate-item::before[\s\S]*content:\s*"·"/);
  assert.match(css, /\.v44-coordinate-item \+ \.v44-coordinate-item::before[\s\S]*color:\s*var\(--v45-separator\)/);
  assert.match(css, /\.v44-coordinate-item \+ \.v44-coordinate-item::before[\s\S]*font-weight:\s*400/);
  assert.doesNotMatch(css, /\.v44-coordinate-item \+ \.v44-coordinate-item[^}]*border-left/);
});

test("dot punctuation is desktop-only so wrapping never starts with a separator", () => {
  assert.match(css, /@media \(min-width: 621px\)[\s\S]*\.v44-coordinate-item \+ \.v44-coordinate-item::before/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*\.v44-coordinate-row[\s\S]*column-gap:\s*12px/);
  assert.match(css, /@media \(max-width: 380px\)[\s\S]*\.v44-coordinate-row[\s\S]*column-gap:\s*10px/);
  assert.doesNotMatch(css, /white-space:\s*nowrap/);
});

test("release version is exactly 0.4.5", () => {
  assert.equal(pkg.version, "0.4.5");
  assert.equal(lock.version, "0.4.5");
  assert.equal(lock.packages[""].version, "0.4.5");
  assert.match(wrangler, /APP_VERSION\s*=\s*"0\.4\.5"/);
});
