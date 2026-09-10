import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const bundle = await readFile(new URL("../public/css/app-v094.css", import.meta.url), "utf8");

test("v0.9.4 has one versioned runtime stylesheet entry", async () => {
  assert.equal((index.match(/<link rel="stylesheet"/g) || []).length, 1);
  assert.match(index, /href="\/css\/app-v094\.css"/);
  for (const legacy of ["styles.css", "onboarding-v050.css", "ui-v050.css", "ui-v070.css", "ui-v080.css", "ui-v081-share-ink.css", "brand-logo-b.css", "ui-v092-share-delivery.css"]) {
    assert.doesNotMatch(index, new RegExp(`href=\\"/${legacy.replace(/[.-]/g, "\\$&")}\\"`));
    await access(new URL(`../public/${legacy}`, import.meta.url));
  }
});

test("bundle preserves source order and shared architecture tokens", () => {
  const order = ["styles.css", "onboarding-v050.css", "ui-v050.css", "ui-v070.css", "ui-v080.css", "ui-v081-share-ink.css", "brand-logo-b.css", "ui-v092-share-delivery.css"];
  let previous = -1;
  for (const source of order) {
    const position = bundle.indexOf(`source: /${source}`);
    assert.ok(position > previous, `source order changed: ${source}`);
    previous = position;
  }
  for (const token of ["--score-ink", "--score-muted", "--score-accent", "--score-surface", "--score-touch-target: 44px"]) assert.match(bundle, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(bundle, /@import\s/);
  assert.match(bundle, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(bundle, /@media \(prefers-reduced-transparency: reduce\)/);
  assert.match(bundle, /@media \(prefers-contrast: more\)/);
  assert.match(bundle, /min-height:\s*44px/);
});
