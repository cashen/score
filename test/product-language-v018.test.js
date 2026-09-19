import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const sources = {
  app: fs.readFileSync(new URL("../public/app.js", import.meta.url), "utf8"),
  coordinateInsight: fs.readFileSync(new URL("../public/coordinate-insight-v100.js", import.meta.url), "utf8"),
  semantics: fs.readFileSync(new URL("../public/record-semantics-v120.js", import.meta.url), "utf8"),
  sharing: fs.readFileSync(new URL("../src/sharing-v2.js", import.meta.url), "utf8")
};
const app = sources.app;

const forbiddenUiPhrases = [
  "当前基线",
  "自动选择当前可用指标",
  "页面只展示分享白名单中的字段",
  "成长轨迹 · 持续更新",
  "整体向前",
  "整体向后",
  "按已分享的考试口径比较",
  "同口径",
  "先看同一种指标",
  "先看同一种比较方式",
  "自动进入这个分享链接",
  "位置向前",
  "位置向后",
  "校内位置向前",
  "校内位置向后",
  "· 最新",
  "· 最新记录",
  "校前 ",
  "校第 ",
  "班第 "
];

const preferredPhrases = [
  "目前的记录",
  "按当前记录显示",
  "页面只显示你选择分享的内容",
  "历次成绩 · 持续更新",
  "比之前靠前",
  "比之前靠后",
  "只按已分享的考试比较",
  "最近一次考试",
  "校内前 "
];

test("v0.12.21 user-facing language removes known internal/AI-style phrases", () => {
  for (const phrase of forbiddenUiPhrases) {
    for (const [name, source] of Object.entries(sources)) {
      assert.equal(source.includes(phrase), false, `forbidden UI phrase remains in ${name}: ${phrase}`);
    }
  }
  for (const phrase of preferredPhrases) assert.equal(app.includes(phrase), true, `preferred UI phrase missing: ${phrase}`);
  assert.equal(app.includes("轨迹</button>"), false);
  assert.equal(app.includes(">成绩</button>"), true);
});

test("v0.12.21 keeps precise total-score wording distinct from calculated subtotals", () => {
  assert.equal(app.includes("六科合计 "), true);
  assert.equal(app.includes("/6 科小计 "), true);
  assert.equal(app.includes("总分未分享"), true);
});
