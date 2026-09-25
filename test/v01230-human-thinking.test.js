import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveDisplayMetric, recordCompleteness, recordSaveSummary, shareBehaviorLabel } from "../public/human-reading-v140.js";

function blankSubjects() {
  return Object.fromEntries(["chinese", "math", "english", "physics", "chemistry", "biology"].map((key) => [key, { rawScore: null, finalScore: null, rankings: [] }]));
}
function exam(extra = {}) {
  return { name: "月考", date: "2026-09-20", status: "normal", overall: { officialScore: null, calculatedScore: null, rankings: [] }, subjects: blankSubjects(), ...extra };
}

test("human default metric follows the value the reader sees", () => {
  const e = exam({ subjects: { ...blankSubjects(), english: { rawScore: 118, rankings: [{ scope: "school", rank: 20, participants: 500, label: "学校", basis: "final_score" }] } } });
  assert.equal(resolveDisplayMetric(e, "english", "auto"), "score");
  const rankOnly = exam({ subjects: { ...blankSubjects(), english: { rawScore: null, rankings: [{ scope: "school", rank: 20, participants: 500, label: "学校", basis: "final_score" }] } } });
  assert.equal(resolveDisplayMetric(rankOnly, "english", "auto"), "schoolRank");
});

test("six subjects complete but official total missing is a distinct state", () => {
  const e = exam({ subjects: Object.fromEntries(["chinese", "math", "english", "physics", "chemistry", "biology"].map((key) => [key, { rawScore: 100, rankings: [] }])) });
  const state = recordCompleteness(e);
  assert.equal(state.isSubjectComplete, true);
  assert.equal(state.officialTotal, false);
  assert.equal(recordSaveSummary(e).nextAction, "继续补这场考试");
  assert.match(recordSaveSummary(e).line, /学校公布总分待补/);
});

test("share behavior distinguishes single live, trajectory live, and snapshot", () => {
  assert.equal(shareBehaviorLabel({ scope: "single", mode: "live" }), "这场考试会随记录更新，但以后新增的考试不会加入");
  assert.equal(shareBehaviorLabel({ scope: "trajectory", mode: "live" }), "历次成绩会持续更新，以后新增的考试也会显示");
  assert.equal(shareBehaviorLabel({ scope: "trajectory", mode: "snapshot" }), "创建时固定的内容");
});

test("app source does not expose the old misleading live-share claim", () => {
  const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(app, /shareBehaviorLabel/);
  assert.match(app, /这场考试会随记录更新，但以后新增的考试不会加入/);
  assert.doesNotMatch(app, /item\.mode === "snapshot" \? "固定当前内容" : "以后新增的考试也会显示"/);
  assert.match(app, /没有记录这门课的考试不会出现在这里/);
});
