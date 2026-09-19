import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

const forbiddenUiPhrases = [
  "当前基线",
  "自动选择当前可用指标",
  "页面只展示分享白名单中的字段",
  "成长轨迹 · 持续更新",
  "整体向前",
  "整体向后",
  "按已分享的考试口径比较",
  "同口径",
  "先看同一种指标"
];

const preferredPhrases = [
  "目前的记录",
  "按当前记录显示",
  "页面只显示你选择分享的内容",
  "历次成绩 · 持续更新",
  "比之前靠前",
  "比之前靠后",
  "只按已分享的考试比较"
];

test("v0.12.20 user-facing language removes known internal/AI-style phrases", () => {
  for (const phrase of forbiddenUiPhrases) assert.equal(app.includes(phrase), false, `forbidden UI phrase remains: ${phrase}`);
  for (const phrase of preferredPhrases) assert.equal(app.includes(phrase), true, `preferred UI phrase missing: ${phrase}`);
});

test("v0.12.20 keeps precise total-score wording distinct from calculated subtotals", () => {
  assert.equal(app.includes("六科合计 "), true);
  assert.equal(app.includes("/6 科小计 "), true);
  assert.equal(app.includes("总分未分享"), true);
});
