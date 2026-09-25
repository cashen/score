import { resolveExamScope, subjectLabel } from "./exam-scope.js";
export const SCORE_SUBJECTS=["chinese","math","english","physics","chemistry","biology"];
export function subjectScore(subject){return subject?.finalScore??subject?.rawScore??null;}
export function examScoreSummary(exam){
 if(exam?.scoreSummary?.kind)return exam.scoreSummary;
 const scope=resolveExamScope(exam),keys=scope.subjects;
 const values=keys.map(key=>subjectScore(exam?.subjects?.[key])).filter(value=>value!=null);
 const recordedSubjects=values.length,subtotal=recordedSubjects?Math.round(values.reduce((sum,value)=>sum+Number(value),0)*10)/10:null;
 const official=exam?.overall?.officialScore??exam?.officialScore??null;
 if(exam?.status==="absent")return {kind:"absent",value:null,subtotal,recordedSubjects,expectedSubjects:keys.length,expectedSubjectKeys:keys,complete:false,label:"本场缺考"};
 if(official!=null)return {kind:"official",value:official,subtotal,recordedSubjects,expectedSubjects:keys.length,expectedSubjectKeys:keys,complete:recordedSubjects===keys.length,label:"总分"};
 if(recordedSubjects===keys.length){const label=keys.length===6?"六科合计":keys.length===1?subjectLabel(keys[0]):"本次科目合计";return {kind:"calculated_complete",value:subtotal,subtotal,recordedSubjects,expectedSubjects:keys.length,expectedSubjectKeys:keys,complete:true,label};}
 if(recordedSubjects)return {kind:"calculated_partial",value:null,subtotal,recordedSubjects,expectedSubjects:keys.length,expectedSubjectKeys:keys,complete:false,label:keys.length===6?recordedSubjects+"/6 科小计":"已录 "+recordedSubjects+"/"+keys.length+" 科"};
 return {kind:"missing",value:null,subtotal:null,recordedSubjects:0,expectedSubjects:keys.length,expectedSubjectKeys:keys,complete:false,label:keys.length===6?"总分待补":"成绩待补"};
}
export function scoreSummaryText(summary){const n=value=>Number(value).toFixed(1).replace(/\.0$/,"");if(!summary||summary.kind==="missing")return summary?.label||"总分待补";if(summary.kind==="absent")return "本场缺考";if(summary.kind==="official")return "学校公布总分 "+n(summary.value)+" 分";if(summary.kind==="calculated_complete")return summary.expectedSubjects===1?summary.label+" "+n(summary.value)+" 分":summary.expectedSubjects===6?"六科合计 "+n(summary.value)+" 分":"本次 "+summary.expectedSubjects+" 科合计 "+n(summary.value)+" 分";if(summary.kind==="calculated_partial")return summary.expectedSubjects===6?summary.recordedSubjects+"/6 科小计 "+n(summary.subtotal)+" 分":"已录 "+summary.recordedSubjects+"/"+summary.expectedSubjects+" 科";return "成绩待补";}
export function examCompleteness(exam){const score=examScoreSummary(exam);const missingSubjects=resolveExamScope(exam).subjects.filter(key=>subjectScore(exam?.subjects?.[key])==null);return {complete:score.kind==="absent"||missingSubjects.length===0,missingSubjects,score};}
