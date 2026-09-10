import test from "node:test";
import assert from "node:assert/strict";
import { analyzeCoordinate, metricBetween, changeDirection } from "../public/coordinate-insight-v100.js";

function exam({ id, date, type = "monthly", series = "A", level = "school", schoolRank = 100, schoolParticipants = 1000, score = 600, chemistryRank = null } = {}) {
  return {
    id,
    date,
    type,
    comparison: { series, level },
    status: "normal",
    overall: { officialScore: score, rankings: [{ scope: "school", label: "学校", rank: schoolRank, participants: schoolParticipants, basis: "final_score" }] },
    subjects: {
      chinese: { finalScore: 100, rawScore: null, rankings: [] },
      math: { finalScore: 100, rawScore: null, rankings: [] },
      english: { finalScore: 100, rawScore: null, rankings: [] },
      physics: { finalScore: 100, rawScore: null, rankings: [] },
      chemistry: { finalScore: 100, rawScore: null, rankings: chemistryRank == null ? [] : [{ scope: "school", label: "学校", rank: chemistryRank, participants: schoolParticipants, basis: "final_score" }] },
      biology: { finalScore: 100, rawScore: null, rankings: [] }
    }
  };
}

const a = exam({ id: "a", date: "2026-09-01", schoolRank: 200, chemistryRank: 100 });
const b = exam({ id: "b", date: "2026-08-20", schoolRank: 250, chemistryRank: 150 });
const c = exam({ id: "c", date: "2026-08-10", schoolRank: 300, chemistryRank: 200 });

test("single exam is an honest baseline", () => {
  const result = analyzeCoordinate([a]);
  assert.equal(result.status, "baseline");
  assert.equal(result.previous, null);
  assert.equal(result.position.school.percentile, 20);
  assert.equal(result.overall, null);
});

test("school percentile is preferred over raw score", () => {
  const current = exam({ id: "cur", date: "2026-09-01", schoolRank: 200, score: 590 });
  const previous = exam({ id: "prev", date: "2026-08-20", schoolRank: 300, score: 610 });
  const metric = metricBetween(current, previous);
  assert.equal(metric.kind, "percentile");
  assert.equal(metric.value, 10);
  assert.equal(changeDirection(metric), "forward");
});

test("ranking without participants falls back to rank", () => {
  const current = exam({ id: "cur", date: "2026-09-01", schoolRank: 20, schoolParticipants: null });
  const previous = exam({ id: "prev", date: "2026-08-20", schoolRank: 30, schoolParticipants: null });
  current.overall.rankings[0].participants = null;
  previous.overall.rankings[0].participants = null;
  const metric = metricBetween(current, previous);
  assert.equal(metric.kind, "rank");
  assert.equal(metric.value, 10);
});

test("score is the last fallback when no comparable rankings exist", () => {
  const current = exam({ id: "cur", date: "2026-09-01", schoolRank: null, score: 612 });
  const previous = exam({ id: "prev", date: "2026-08-20", schoolRank: null, score: 600 });
  current.overall.rankings = [];
  previous.overall.rankings = [];
  const metric = metricBetween(current, previous);
  assert.equal(metric.kind, "score");
  assert.equal(metric.value, 12);
});

test("different exam categories do not produce a false trend", () => {
  const current = exam({ id: "cur", date: "2026-09-01", type: "mock1", schoolRank: 200 });
  const previous = exam({ id: "prev", date: "2026-08-20", type: "monthly", schoolRank: 300 });
  const result = analyzeCoordinate([current, previous]);
  assert.equal(result.status, "baseline");
  assert.equal(result.overall, null);
});

test("repeated subject decline becomes an observation point", () => {
  const result = analyzeCoordinate([a, b, c]);
  assert.equal(result.attention?.key, "chemistry");
  assert.equal(result.attention?.backward, 2);
  assert.ok(result.drivers.some((item) => item.key === "chemistry" && item.direction === "forward"));
});

test("missing subject data is ignored rather than invented", () => {
  const current = exam({ id: "cur", date: "2026-09-01", chemistryRank: null });
  const previous = exam({ id: "prev", date: "2026-08-20", chemistryRank: null });
  const result = analyzeCoordinate([current, previous]);
  assert.equal(result.drivers.some((item) => item.key === "chemistry"), false);
});

test("special exam status is not compared", () => {
  const current = exam({ id: "cur", date: "2026-09-01", schoolRank: 200 });
  const previous = exam({ id: "prev", date: "2026-08-20", schoolRank: 300 });
  current.status = "absent";
  const result = analyzeCoordinate([current, previous]);
  assert.equal(result.status, "baseline");
  assert.equal(result.overall, null);
});
