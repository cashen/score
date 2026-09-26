const DEFAULT_STATE = Object.freeze({
  me: null, csrf: null, student: null, exams: [], trash: [], shares: [], shareResult: null,
  familyMembers: [], invitations: [], tab: "overview", trajectoryView: "total", subjectKey: null,
  subjectMetric: "auto", selectedExamId: null, editingExam: null, notice: "", noticeTone: "notice"
});

export function createAppState() { return { ...DEFAULT_STATE, familyMembers: [], invitations: [], exams: [], trash: [], shares: [] }; }

export function captureViewContext(state) {
  return { tab: state?.tab || "overview", trajectoryView: state?.trajectoryView || "total", subjectKey: state?.subjectKey || null, subjectMetric: state?.subjectMetric || "auto", selectedExamId: state?.selectedExamId || null };
}
export function restoreViewContext(state, context = {}) {
  state.tab = context.tab || "overview";
  state.trajectoryView = context.trajectoryView || "total";
  state.subjectKey = context.subjectKey || null;
  state.subjectMetric = context.subjectMetric || "auto";
  state.selectedExamId = context.selectedExamId || null;
  return state;
}

export function selectCurrentExam(state) {
  return state?.selectedExamId ? (state.exams || []).find((exam) => exam.id === state.selectedExamId) || null : null;
}

export function selectLatestExam(state, latestExamFn) {
  return typeof latestExamFn === "function" ? latestExamFn(state?.exams || []) : (state?.exams || [])[0] || null;
}

export function selectSubject(state) {
  return state?.subjectKey || null;
}

export function dispatchViewAction(state, action = {}) {
  switch (action.type) {
    case "view/overview":
      state.tab = "overview";
      state.trajectoryView = action.view || "total";
      state.subjectKey = action.view === "subject" ? action.subjectKey || null : null;
      state.subjectMetric = action.view === "subject" ? action.metric || "auto" : "auto";
      state.selectedExamId = action.view === "timeline" ? action.examId || null : null;
      return state;
    case "view/tab":
      state.tab = action.tab || "overview";
      return state;
    case "view/subject":
      state.tab = "overview";
      state.trajectoryView = "subject";
      state.subjectKey = action.subjectKey || null;
      state.subjectMetric = action.metric || "auto";
      state.selectedExamId = null;
      return state;
    case "view/timeline":
      state.tab = "overview";
      state.trajectoryView = "timeline";
      state.selectedExamId = action.examId || null;
      return state;
    case "view/exam-edit":
      state.editingExam = action.exam || null;
      return state;
    case "view/clear-exam":
      state.selectedExamId = null;
      return state;
    default:
      throw new Error(`Unknown view action: ${action.type}`);
  }
}

export const APPLICATION_ARCHITECTURE_VERSION = "0.13.2";
