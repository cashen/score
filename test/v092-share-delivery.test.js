import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { shareUrlFor } from "../public/share-delivery-v092.js";
import { buildShareSvg, shareProjectionRows } from "../public/share-image-v092.js";

test("share URLs are complete, origin-bound, and encode locators", () => {
  assert.equal(shareUrlFor("https://score.example", { kind: "public", locator: "wang-2027" }), "https://score.example/p/wang-2027");
  assert.equal(shareUrlFor("https://score.example", { kind: "secret", locator: "hash/with space" }), "https://score.example/share/hash%2Fwith%20space");
  assert.equal(shareUrlFor("https://score.example", { kind: "public" }), "");
});

test("share delivery UI keeps copy/open actions and keeps public pages uncluttered", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../public/ui-v092-share-delivery.css", import.meta.url), "utf8");
  assert.match(app, /data-action=\"copy-share\"/);
  assert.match(app, /生成完整分享页图/);
  assert.doesNotMatch(app, /下载 \/ 分享图片/);
  assert.doesNotMatch(app, /data-action=\"public-share-image\"/);
  assert.match(app, /target=\"_blank\" rel=\"noopener noreferrer\"/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /prefers-contrast: more/);
});

test("share image mirrors total, subject, and timeline data without notes", () => {
  const data = { student: { displayName: "小王" }, exams: [{ name: "九月月考", date: "2026-09-01", overall: { officialScore: 580, rankings: [{ scope: "school", rank: 12 }] }, subjects: { math: { rawScore: 120 } }, notes: "private" }] };
  const share = { kind: "public", scope: "trajectory", fields: { overallScore: true, overallRank: true, subjectScores: true, subjectRanks: true } };
  assert.equal(shareProjectionRows({ data, share, view: "total" })[0].value, "580");
  assert.equal(shareProjectionRows({ data, share, view: "subject", subject: "math" })[0].value, 120);
  const svg = buildShareSvg({ data, share, view: "timeline" });
  assert.match(svg, /考试时间轴/);
  assert.match(svg, /单科成绩/);
  assert.match(svg, /总成绩/);
  assert.doesNotMatch(svg, /private/);
  assert.match(svg, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
});
