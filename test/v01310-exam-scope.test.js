import test from "node:test";
import assert from "node:assert/strict";
import { normalizeExam } from "../src/lib/model.js";
import { resolveExamScope } from "../public/exam-scope.js";
import { examScoreSummary } from "../public/score-core-v090.js";
import { recordCompleteness } from "../public/human-reading-v140.js";
import { publicProjection } from "../src/domain/share-projection.js";

test("stores actual tested subjects",()=>{const exam=normalizeExam({name:"英语周测",date:"2026-09-25",type:"weekly",subjectSet:["english"],subjects:{english:{rawScore:103}}});assert.deepEqual(exam.subjectSet,["english"]);});
test("one model supports single multi and full scope",()=>{assert.equal(resolveExamScope({subjectSet:["english"]}).isSingle,true);assert.deepEqual(resolveExamScope({subjectSet:["physics","chemistry"]}).subjects,["physics","chemistry"]);assert.equal(resolveExamScope({subjectSet:["chinese","math","english","physics","chemistry","biology"]}).isFull,true);});
test("legacy records preserve six-subject compatibility when scope is unknown",()=>{assert.equal(resolveExamScope({subjects:{english:{rawScore:100}}}).isFull,true);assert.equal(resolveExamScope({subjects:{english:{rawScore:100},physics:{rawScore:80}}}).isFull,true);});
test("score and completeness follow subjectSet",()=>{const one={subjectSet:["english"],subjects:{english:{rawScore:103}}};assert.equal(examScoreSummary(one).expectedSubjects,1);assert.equal(examScoreSummary(one).label,"英语");const two={subjectSet:["physics","chemistry"],subjects:{physics:{rawScore:80},chemistry:{rawScore:null}}};assert.equal(recordCompleteness(two).subjectTotal,2);assert.deepEqual(recordCompleteness(two).missingSubjects,["化学"]);});
test("share projection excludes deleted and unselected subjects",()=>{const student={displayName:"测试",graduationYear:2027};const live={id:"a",name:"英语周测",date:"2026-09-25",type:"weekly",subjectSet:["english"],subjects:{english:{rawScore:103},physics:{rawScore:80}},overall:{rankings:[]}};const deleted={id:"b",name:"已删除",date:"2026-09-24",type:"weekly",deletedAt:"2026-09-25T01:00:00.000Z",subjectSet:["english"],subjects:{english:{rawScore:90}}};const fields={displayName:true,graduationYear:true,school:false,className:false,overallScore:true,overallRank:true,subjectScores:true,subjectRanks:true,history:true,examStatus:false,comparisonContext:false,status:false,comparison:false};const data=publicProjection(student,[live,deleted],fields);assert.equal(data.exams.length,1);assert.deepEqual(data.exams[0].subjectSet,["english"]);assert.deepEqual(Object.keys(data.exams[0].subjects),["english"]);});
