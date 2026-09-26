// Canonical exam scope semantics.
export const EXAM_SCOPE_VERSION = "0.13.4";
export const SUBJECT_KEYS = Object.freeze(["chinese","math","english","physics","chemistry","biology"]);
const LABELS = Object.freeze({chinese:"语文",math:"数学",english:"英语",physics:"物理",chemistry:"化学",biology:"生物"});
const valid = key => SUBJECT_KEYS.includes(key);
export function normalizeSubjectSet(value){
  if(!Array.isArray(value)) return null;
  if(value.some(key=>!valid(key))) throw Object.assign(new Error("考试科目无效"),{code:"invalid_subject_set",field:"subjectSet"});
  const result=[...new Set(value)];
  if(!result.length) throw Object.assign(new Error("本次考试至少选择一门科目"),{code:"empty_subject_set",field:"subjectSet"});
  return result;
}
function hasRecord(exam,key){const subject=exam?.subjects?.[key]||{};return subject.finalScore!=null||subject.rawScore!=null||(Array.isArray(subject.rankings)&&subject.rankings.some(item=>item?.rank!=null||item?.participants!=null));}
export function legacySubjectSet(exam){return [...SUBJECT_KEYS];}
export function resolveExamScope(exam){const explicit=Array.isArray(exam?.subjectSet)?exam.subjectSet.filter(valid):null;const subjects=explicit?.length?[...new Set(explicit)]:legacySubjectSet(exam);return {subjects,source:explicit?.length?"explicit":subjects.length===1?"legacy-inferred-single":"legacy-fallback",subjectCount:subjects.length,isSingle:subjects.length===1,isFull:subjects.length===SUBJECT_KEYS.length};}
export const subjectLabel=key=>LABELS[key]||key;
export const subjectLabels=keys=>keys.map(subjectLabel);
export const subjectKeysForDisplay=exam=>resolveExamScope(exam).subjects;
export function examScopeLabel(exam){const scope=resolveExamScope(exam);return scope.isSingle?subjectLabel(scope.subjects[0]):scope.isFull?"六科":subjectLabels(scope.subjects).join("、");}
export function examScoreLabel(exam,summary){if(!summary)return "";if(summary.kind==="official")return "这次总分";const scope=resolveExamScope(exam);return scope.isSingle?subjectLabel(scope.subjects[0])+"成绩":scope.isFull?"六科合计":"本次科目合计";}
