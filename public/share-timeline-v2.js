const TIMELINE_SUBJECTS=[["chinese","语文"],["math","数学"],["english","英语"],["physics","物理"],["chemistry","化学"],["biology","生物"]];

function tEsc(value=""){return String(value).replace(/[&<>'"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function tDate(value){if(!value)return"—";const m=String(value).match(/^\d{4}-(\d{2})-(\d{2})$/);return m?`${m[1]}/${m[2]}`:String(value);}
function tRank(rankings,scope){return(rankings||[]).find((item)=>item.scope===scope&&item.rank!=null)||null;}
function tRankText(ranking){if(!ranking?.rank)return"—";return ranking.participants?`${ranking.rank} / ${ranking.participants}`:`第 ${ranking.rank} 名`;}
function tScore(subject){return subject?.finalScore??subject?.rawScore??null;}

async function tApi(path){const response=await fetch(path,{credentials:"same-origin"});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.message||`请求失败 (${response.status})`);return payload;}

function tDetail(exam,isCurrent){
  const school=tRank(exam.overallRankings,"school"),clazz=tRank(exam.overallRankings,"class");
  const subjects=TIMELINE_SUBJECTS.map(([key,label])=>{const subject=exam.subjects?.[key]||{},score=tScore(subject),rank=tRank(subject.rankings,"school");return `<div class="share-timeline-subject"><small>${label}</small><strong>${score??"—"}</strong><span>${rank?.rank?`校 ${tRankText(rank)}`:"未分享校排名"}</span></div>`;}).join("");
  return `<div class="share-timeline-detail-head"><div><div class="eyebrow">${isCurrent?"当前考试":"历史考试"}</div><h3>${tEsc(exam.name||"未命名考试")}</h3><div class="muted">${tEsc(exam.date||"")}</div></div>${isCurrent?`<span class="badge">当前</span>`:`<span class="badge">已完成</span>`}</div><div class="share-timeline-metrics"><div class="share-timeline-metric"><small>总分</small><strong>${exam.overallScore??"—"}</strong></div><div class="share-timeline-metric"><small>校排名</small><strong>${tRankText(school)}</strong></div><div class="share-timeline-metric"><small>班排名</small><strong>${tRankText(clazz)}</strong></div></div><div class="share-timeline-subjects">${subjects}</div>`;
}

function tMount(exams,anchor){
  if(!Array.isArray(exams)||exams.length<2||document.querySelector("[data-share-timeline-v2]"))return;
  const chronological=[...exams].reverse();
  const currentId=exams[0]?.id;
  const section=document.createElement("section");
  section.className="card card-pad share-timeline-v2";
  section.dataset.shareTimelineV2="1";
  section.innerHTML=`<div class="share-timeline-head"><div><div class="eyebrow">考试时间轴</div><h2>点某次考试，看当时的成绩</h2><p>从较早到最近排列。当前考试和过去考试使用不同状态；手机可左右滑动后点选。</p></div><span class="badge">${exams.length} 次</span></div><div class="share-timeline-scroll" tabindex="0" aria-label="历次考试时间轴"><div class="share-timeline-track" role="tablist">${chronological.map((exam)=>{const current=exam.id===currentId;return `<button type="button" class="share-timeline-node ${current?"is-current":"is-past"}" role="tab" aria-selected="${current?"true":"false"}" data-timeline-exam="${tEsc(exam.id)}"><small>${tEsc(tDate(exam.date))}</small><strong>${tEsc(exam.name||"未命名考试")}</strong><span>${current?"当前":"已完成"}</span></button>`;}).join("")}</div></div><div class="share-timeline-detail" role="tabpanel" aria-live="polite"></div>`;
  anchor.insertAdjacentElement("afterend",section);
  const detail=section.querySelector(".share-timeline-detail");
  const render=(exam)=>{detail.innerHTML=tDetail(exam,exam.id===currentId);};
  section.querySelectorAll("[data-timeline-exam]").forEach((button)=>button.addEventListener("click",()=>{
    const exam=chronological.find((item)=>item.id===button.dataset.timelineExam);if(!exam)return;
    section.querySelectorAll("[data-timeline-exam]").forEach((item)=>item.setAttribute("aria-selected",String(item===button)));
    render(exam);
    button.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});
  }));
  render(exams[0]);
  requestAnimationFrame(()=>section.querySelector(".share-timeline-node.is-current")?.scrollIntoView({block:"nearest",inline:"end"}));
}

async function tBoot(){
  const path=location.pathname;let kind=null,locator=null;
  if(path.startsWith("/share/")){kind="secret";locator=path.slice(7);}else if(path.startsWith("/p/")){kind="public";locator=path.slice(3);}else return;
  try{
    const result=await tApi(`/api/share/${kind}/${encodeURIComponent(locator)}`);
    if(result.share?.scope!=="trajectory")return;
    const exams=result.data?.exams||[];
    const anchor=document.querySelector("[data-trajectory-v2]")||document.querySelector(".public-shell > .card");
    if(anchor)tMount(exams,anchor);
  }catch{}
}

tBoot();
