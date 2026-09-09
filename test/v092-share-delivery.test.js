import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { shareUrlFor, shareFileName } from "../public/share-delivery-v092.js";

test("share URLs are complete, origin-bound, and encode locators", () => {
  assert.equal(shareUrlFor("https://score.example", { kind: "public", locator: "wang-2027" }), "https://score.example/p/wang-2027");
  assert.equal(shareUrlFor("https://score.example", { kind: "secret", locator: "hash/with space" }), "https://score.example/share/hash%2Fwith%20space");
  assert.equal(shareUrlFor("https://score.example", { kind: "public" }), "");
});

test("share delivery UI keeps copy/open/image actions reachable on mobile", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../public/ui-v092-share-delivery.css", import.meta.url), "utf8");
  assert.match(app, /data-action=\"copy-share\"/);
  assert.match(app, /data-action=\"share-image\"/);
  assert.match(app, /target=\"_blank\" rel=\"noopener noreferrer\"/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /overflow-wrap: anywhere/);
});

test("image names are deterministic and privacy-neutral", () => {
  assert.equal(shareFileName({ kind: "public", scope: "trajectory" }), "gaosan-coordinate-public-trajectory.png");
});
