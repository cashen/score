import test from "node:test";
import assert from "node:assert/strict";
import { createAppState, dispatchViewAction, selectCurrentExam, APPLICATION_ARCHITECTURE_VERSION } from "../public/application-v001.js";

test("application layer owns view transitions without DOM dependencies", () => {
  const state = createAppState();
  dispatchViewAction(state, { type: "view/subject", subjectKey: "math", metric: "score" });
  assert.equal(state.tab, "overview");
  assert.equal(state.trajectoryView, "subject");
  assert.equal(state.subjectKey, "math");
  assert.equal(state.subjectMetric, "score");
  assert.equal(APPLICATION_ARCHITECTURE_VERSION, "0.13.0");
});

test("application selector reads selected exam from state", () => {
  const state = createAppState();
  state.exams = [{ id: "e1" }, { id: "e2" }];
  dispatchViewAction(state, { type: "view/timeline", examId: "e2" });
  assert.deepEqual(selectCurrentExam(state), { id: "e2" });
});
