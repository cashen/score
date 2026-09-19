import test from "node:test";
import assert from "node:assert/strict";

import {
  comparableRanking,
  findComparableExamForSubject,
  latestExam,
  metricBetween,
  percentile,
  rankingState,
  sortExamsChronologically,
  subjectRecordState
} from "../public/record-semantics-v120.js";
import { normalizeExam } from "../src/lib/model.js";

function blankSubjects() {
  return Object.fromEntries(["chinese", "math", "english", "physics", "chemistry", "biology"].map((key) => [
    key,
    { rawScore: null, finalScore: null, rankings: [] }
  ]));
}

function exam(id, date, createdAt, extra = {}) {
  return {
    id,
    name: id,
    date,
    createdAt,
    status: "normal",
    comparison: { series: "monthly-1", level: "school" },
    overall: { officialScore: null, calculatedScore: null, rankings: [] },
    subjects: blankSubjects(),
    ...extra
  };
}

test("same-date edit order does not redefine latest exam", () => {
  const older = exam("older", "2026-09-18", "2026-09-18T08:00:00.000Z");
  const newer = exam("newer", "2026-09-18", "2026-09-19T08:00:00.000Z");
  assert.equal(latestExam([older, newer]).id, "newer");
  const editedOlder = { ...older, updatedAt: "2026-09-20T08:00:00.000Z" };
  assert.equal(latestExam([editedOlder, newer]).id, "newer");
  assert.deepEqual(sortExamsChronologically([editedOlder, newer]).map(x => x.id), ["newer", "older"]);
});

test("latest exam remains latest even when the newest record is partial", () => {
  const latest = exam("latest", "2026-09-18", "2026-09-18T08:00:00.000Z", {
    overall: { officialScore: null, calculatedScore: 420, rankings: [] },
    subjects: { ...blankSubjects(), english: { rawScore: 88, finalScore: null, rankings: [] } }
  });
  const olderComplete = exam("older", "2026-09-10", "2026-09-10T08:00:00.000Z", {
    overall: { officialScore: 600, calculatedScore: 600, rankings: [] },
    subjects: Object.fromEntries(["chinese", "math", "english", "physics", "chemistry", "biology"].map((key) => [key, { rawScore: 100, finalScore: null, rankings: [] }]))
  });
  assert.equal(latestExam([olderComplete, latest]).id, "latest");
});

test("subject empty state does not manufacture placeholders", () => {
  const state = subjectRecordState(exam("e", "2026-09-18", "2026-09-18T08:00:00.000Z"), "math");
  assert.equal(state.hasAny, false);
  assert.equal(state.status, "empty");
});

test("overall ranking and subject ranking stay separate", () => {
  const previous = exam("prev", "2026-09-10", "2026-09-10T08:00:00.000Z", {
    overall: { officialScore: 590, calculatedScore: 590, rankings: [{ scope: "school", rank: 60, participants: 500, label: "学校", basis: "final_score" }] },
    subjects: { ...blankSubjects(), english: { rawScore: 118, finalScore: null, rankings: [] } }
  });
  const current = exam("current", "2026-09-18", "2026-09-18T08:00:00.000Z", {
    overall: { officialScore: 600, calculatedScore: 600, rankings: [{ scope: "school", rank: 20, participants: 500, label: "学校", basis: "final_score" }] },
    subjects: { ...blankSubjects(), english: { rawScore: 120, finalScore: null, rankings: [] } }
  });
  assert.equal(metricBetween(current, previous, "english", "schoolRank"), null);
  assert.equal(metricBetween(current, previous, null, "schoolRank")?.kind, "percentile");
});

test("auto metric prefers school percentile, then school rank, class rank, score", () => {
  const base = exam("base", "2026-09-10", "2026-09-10T08:00:00.000Z", {
    subjects: {
      ...blankSubjects(),
      english: {
        rawScore: 118, finalScore: null,
        rankings: [
          { scope: "school", rank: 50, participants: 500, label: "学校", basis: "final_score" },
          { scope: "class", rank: 5, participants: 50, label: "班", basis: "final_score" }
        ]
      }
    }
  });
  const current = exam("current", "2026-09-18", "2026-09-18T08:00:00.000Z", {
    subjects: {
      ...blankSubjects(),
      english: {
        rawScore: 120, finalScore: null,
        rankings: [
          { scope: "school", rank: 30, participants: 500, label: "学校", basis: "final_score" },
          { scope: "class", rank: 4, participants: 50, label: "班", basis: "final_score" }
        ]
      }
    }
  });
  const change = metricBetween(current, base, "english", "auto");
  assert.equal(change.metric, "schoolRank");
  assert.equal(change.kind, "percentile");
});

test("rank-only state stays rank-only and cannot invent percentile", () => {
  const state = rankingState([{scope:"school",rank:38,participants:null,label:"学校",basis:"final_score"}],"school");
  assert.equal(state.rank, 38);
  assert.equal(state.percentile, null);
  assert.equal(percentile(38, null), null);
});

test("subject comparison requires subject data in both exams", () => {
  const previous = exam("prev", "2026-09-10", "2026-09-10T08:00:00.000Z", {
    subjects:{...blankSubjects(), english:{rawScore:118,finalScore:null,rankings:[]}}
  });
  const current = exam("current", "2026-09-18", "2026-09-18T08:00:00.000Z", {
    subjects:{...blankSubjects(), english:{rawScore:null,finalScore:null,rankings:[]}}
  });
  const result = findComparableExamForSubject([current, previous], current, "english", "auto");
  assert.equal(result.status, "not_comparable");
  assert.match(result.reason, /当前科目没有已记录数据/);
});

test("normalizeExam rejects final score above full score", () => {
  assert.throws(() => normalizeExam({
    name:"测试", date:"2026-09-18", type:"monthly",
    overall:{officialScore:null,rankings:[]},
    subjects:{english:{fullScore:150,rawScore:null,finalScore:151}}
  }), /赋分后不能高于满分/);
});

test("comparable ranking requires same scope, label and basis", () => {
  assert.equal(comparableRanking({scope:"school",label:"A",basis:"final_score"},{scope:"school",label:"A",basis:"final_score"}),true);
  assert.equal(comparableRanking({scope:"school",label:"A",basis:"final_score"},{scope:"class",label:"A",basis:"final_score"}),false);
});
