const V2_SUBJECTS = [["chinese","语文"],["math","数学"],["english","英语"],["physics","物理"],["chemistry","化学"],["biology","生物"]];
let v2Me = null;
let v2Enhancing = false;

function v2Esc(value="") { return String(value).replace(/[&<>'"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }

async function v2Api(path, options={}, csrf=null) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("content-type")) headers.set("content-type","application/json");
  if (csrf && !["GET","HEAD"].includes((options.method||"GET").toUpperCase())) headers.set("x-score-csrf",csrf);
  const response = await fetch(path,{credentials:"same-origin",...options,headers});
  const payload = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(payload.message || `请求失败 (${response.status})`);
  return payload;
}

function v2Rank(rankings, scope) { return (rankings||[]).find((item)=>item.scope===scope && item.rank!=null) || null; }
function v2OverallRank(exam, scope="school") { return v2Rank(exam?.overall?.rankings || exam?.overallRankings, scope); }
function v2Percentile(ranking) {
  const rank=ranking?.rank, total=ranking?.participants;
  if (!Number.isInteger(rank)||!Number.isInteger(total)||rank<1||total<rank) return null;
  return Math.round((rank/total)*1000)/10;
}
function v2Score(subject) { return subject?.finalScore ?? subject?.rawScore ?? null; }
function v2Fmt(value) { return Number(value).toFixed(1).replace(/\.0$/,
""); }

function v2ComparePosition(latest, previous, scope="school") {
  const current=v2OverallRank(latest,scope), prior=v2OverallRank(previous,scope);
  if (!current?.rank || !prior?.rank) return null;
  const currentPct=v2Percentile(current), priorPct=v2Percentile(prior);
  const label=scope==="school"?"学校":"班级";
  if (currentPct!=null && priorPct!=null) {
    const delta=priorPct-currentPct;
    return { headline:`${label}位置 ${delta>0?"上升":delta<0?"回落":"持平"}`, detail:`前 ${v2Fmt(priorPct)}% → 前 ${v2Fmt(currentPct)}%${delta===0?"":`，${delta>0?"提升":"回落"} ${v2Fmt(Math.abs(delta))} 个百分点`}`, caveat:"两次都记录了总人数，因此按相对位置比较。" };
  }
  const delta=prior.rank-current.rank;
  return { headline:`${label}名次 ${delta>0?"向前":delta<0?"向后":"不变"}`, detail:`第 ${prior.rank} 名 → 第 ${current.rank} 名${delta===0?"":`，${delta>0?"前进":"后退"} ${Math.abs(delta)} 名`}`, caveat:"至少一次总人数缺失，只比较名次；参考人数变化时不能当作百分位变化。" };
}

function v2RecentTrend(exams) {
  const recent=exams.slice(0,6).reverse();
  const pct=recent.map((exam)=>v2Percentile(v2OverallRank(exam,"school"))).filter((x)=>x!=null);
  if (pct.length>=3) {
    const first=pct[0], last=pct[pct.length-1], delta=first-last, swing=Math.max(...pct)-Math.min(...pct);
    return { label:delta>=2?"总体向上":delta<=-2?"总体回落":swing>=5?"波动较大":"大体稳定", detail:`最近 ${pct.length} 次可比考试：前 ${v2Fmt(first)}% → 前 ${v2Fmt(last)}%`, caveat:"按学校百分位观察，越靠前越好。" };
  }
  const ranks=recent.map((exam)=>v2OverallRank(exam,"school")?.rank).filter(Number.isInteger);
  if (ranks.length>=3) {
    const first=ranks[0], last=ranks[ranks.length-1], delta=first-last;
    return { label:delta>0?"名次总体向前":delta<0?"名次总体向后":"名次大体持平", detail:`最近 ${ranks.length} 次有校排名的考试：第 ${first} 名 → 第 ${last} 名`, caveat:"总人数不完整，只能看名次方向，不能推断百分位。" };
  }
  return null;
}

function v2SubjectChanges(latest, previous) {
  const result=[];
  for (const [key,label] of V2_SUBJECTS) {
    const current=latest?.subjects?.[key]||{}, prior=previous?.subjects?.[key]||{};
    const cr=v2Rank(current.rankings,"school"), pr=v2Rank(prior.rankings,"school"), cp=v2Percentile(cr), pp=v2Percentile(pr);
    if (cp!=null && pp!=null) result.push({label,kind:"rank",delta:pp-cp,detail:`前 ${v2Fmt(pp)}% → 前 ${v2Fmt(cp)}%`});
    else if (cr?.rank!=null && pr?.rank!=null) result.push({label,kind:"rank",delta:pr.rank-cr.rank,detail:`第 ${pr.rank} 名 → 第 ${cr.rank} 名`});
    else {
      const cs=v2Score(current), ps=v2Score(prior);
      if (cs!=null && ps!=null) result.push({label,kind:"score",delta:cs-ps,detail:`${ps} → ${cs}`});
    }
  }
  return result;
}

function v2Contributors(latest, previous) {
  const changes=v2SubjectChanges(latest,previous);
  const ranked=changes.filter((x)=>x.kind==="rank"&&x.delta!==0).sort((a,b)=>b.delta-a.delta);
  const chosen=[...ranked.filter((x)=>x.delta>0).slice(0,2),...ranked.filter((x)=>x.delta<0).slice(-2)];
  const scoreOnly=changes.filter((x)=>x.kind==="score"&&x.delta!==0).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).slice(0,2);
  const items=chosen.length?chosen:scoreOnly;
  if (!items.length) return `<div class="muted">两次考试还没有足够的单科数据判断变化来源。</div>`;
  return `<div class="trajectory-chips">${items.map((item)=>`<span class="trajectory-chip ${item.delta>0?"is-up":item.delta<0?"is-down":""}"><b>${item.label}</b> ${item.kind==="score"?"分数 ":""}${v2Esc(item.detail)}</span>`).join("")}</div><small class="muted">${chosen.length?"优先依据单科校排名/百分位判断。":"这里只能看到分数变化；不同考试难度不同，不能直接等同于相对位置变化。"}</small>`;
}

function v2Summary(exams, external=false) {
  if (!Array.isArray(exams)||exams.length<2) return "";
  const latest=exams[0], previous=exams[1];
  const position=v2ComparePosition(latest,previous,"school")||v2ComparePosition(latest,previous,"class");
  const trend=v2RecentTrend(exams);
  return `<section class="card card-pad trajectory-insight ${external?"trajectory-insight-external":""}" data-trajectory-v2><div class="section-head"><div><div class="eyebrow">高三轨迹</div><h2>这次和上次相比</h2></div><span class="badge">${exams.length} 次记录</span></div><div class="trajectory-insight-grid"><div class="trajectory-insight-item"><small>孩子现在在哪</small><strong>${v2Esc(position?.headline||"可比排名不足")}</strong><p>${v2Esc(position?.detail||"补充连续两次学校或班级排名后，这里会直接告诉你位置变化。")}</p><em>${v2Esc(position?.caveat||"")}</em></div><div class="trajectory-insight-item"><small>最近有没有变化</small><strong>${v2Esc(trend?.label||"暂时看不出趋势")}</strong><p>${v2Esc(trend?.detail||"至少需要 3 次有可比排名的考试。")}</p><em>${v2Esc(trend?.caveat||"")}</em></div><div class="trajectory-insight-item trajectory-contributors"><small>变化来自哪一科</small>${v2Contributors(latest,previous)}</div></div></section>`;
}

async function v2Context() {
  v2Me = v2Me || await v2Api("/api/me");
  const id=document.querySelector("#student-select")?.value || v2Me.students?.[0]?.id;
  return { me:v2Me, student:v2Me.students?.find((s)=>s.id===id)||v2Me.students?.[0] };
}

async function v2CurrentExams(studentId) {
  const result=await v2Api(`/api/students/${studentId}/exams`);
  return result.exams||[];
}

function v2ScopeControls(prefix, exams) {
  const canTrajectory=exams.length>=2;
  return `<div class="share-scope-v2" data-share-scope-box="${prefix}"><strong>你要分享什么？</strong><label><input type="radio" name="${prefix}-scope-v2" value="trajectory" ${canTrajectory?"checked":"disabled"}><span>分享高三轨迹</span><small>把多次考试放在一起看位置变化和科目来源${canTrajectory?"":"（至少需要 2 次考试）"}</small></label><label><input type="radio" name="${prefix}-scope-v2" value="single" ${canTrajectory?"":"checked"}><span>分享某一次考试</span><small>只分享你选中的这一张成绩记录</small></label><div class="field share-single-picker"><label>选择考试</label><select data-share-exam-v2="${prefix}" ${canTrajectory?"disabled":""}>${exams.map((exam)=>`<option value="${v2Esc(exam.id)}">${v2Esc(exam.name)} · ${v2Esc(exam.date)}</option>`).join("")}</select></div></div>`;
}

function v2BindScope(prefix) {
  const box=document.querySelector(`[data-share-scope-box='${prefix}']`);
  if (!box||box.dataset.bound==="1") return;
  box.dataset.bound="1";
  const history=document.querySelector(`[name='${prefix}-history']`);
  if (history?.closest("label")) history.closest("label").hidden=true;
  const sync=()=>{
    const scope=box.querySelector(`input[name='${prefix}-scope-v2']:checked`)?.value||"single";
    const picker=box.querySelector(`[data-share-exam-v2='${prefix}']`);
    if (picker) picker.disabled=scope!=="single";
    if (history) history.checked=scope==="trajectory";
  };
  box.querySelectorAll(`input[name='${prefix}-scope-v2']`).forEach((input)=>input.addEventListener("change",sync));
  sync();
}

function v2Fields(prefix, scope) {
  const result={};
  for (const key of ["displayName","graduationYear","school","className","overallScore","overallRank","subjectScores","subjectRanks"]) result[key]=Boolean(document.querySelector(`[name='${prefix}-${key}']`)?.checked);
  result.history=scope==="trajectory";
  return result;
}

async function v2Copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  const area=document.createElement("textarea"); area.value=text; area.style.position="fixed"; area.style.opacity="0"; document.body.append(area); area.select();
  let ok=false; try { ok=document.execCommand("copy"); } catch {} area.remove(); return ok;
}

async function v2CreateShare(kind) {
  const prefix=kind==="public"?"public":"secret", {me,student}=await v2Context();
  const scope=document.querySelector(`input[name='${prefix}-scope-v2']:checked`)?.value||"single";
  const body={kind,mode:document.querySelector(`#${prefix}-mode`)?.value||"live",scope,fields:v2Fields(prefix,scope)};
  if (scope==="single") body.examId=document.querySelector(`[data-share-exam-v2='${prefix}']`)?.value||null;
  if (kind==="secret") { const expiry=document.querySelector("#secret-expiry")?.value; if (expiry) body.expiresAt=`${expiry}T23:59:59.999Z`; }
  else body.slug=document.querySelector("#public-slug")?.value?.trim()||"";
  const result=await v2Api(`/api/students/${student.id}/shares`,{method:"POST",body:JSON.stringify(body)},me.csrf);
  const url=kind==="secret"?`${location.origin}/share/${result.token}`:`${location.origin}/p/${result.share.locator}`;
  const copied=await v2Copy(url);
  sessionStorage.setItem("score:v020:share-notice",`${scope==="trajectory"?"高三轨迹":"单次考试"}分享已创建：${url}${copied?"（已复制）":""}`);
  document.querySelector("[data-tab='overview']")?.click();
  setTimeout(()=>document.querySelector("[data-tab='sharing']")?.click(),30);
}

async function v2EnhanceSharing(exams) {
  const cards=[...document.querySelectorAll(".share-grid .share-card")];
  if (cards.length<2) return;
  for (const [index,prefix] of ["secret","public"].entries()) {
    const card=cards[index];
    if (!card.querySelector(`[data-share-scope-box='${prefix}']`)) { const holder=document.createElement("div"); holder.innerHTML=v2ScopeControls(prefix,exams); card.querySelector("p.muted")?.after(holder.firstElementChild); }
    v2BindScope(prefix);
  }
  const notice=sessionStorage.getItem("score:v020:share-notice");
  if (notice&&!document.querySelector("[data-v020-share-notice]")) { const box=document.createElement("div"); box.className="notice-box"; box.dataset.v020ShareNotice="1"; box.textContent=notice; document.querySelector("main.container section .section-head")?.after(box); sessionStorage.removeItem("score:v020:share-notice"); }
  try {
    const {student}=await v2Context(), list=await v2Api(`/api/students/${student.id}/shares`), map=new Map((list.shares||[]).map((item)=>[item.locator,item]));
    document.querySelectorAll(".share-item [data-action='revoke-share']").forEach((button)=>{ const item=map.get(button.dataset.locator),row=button.closest(".share-item"); if(!item||!row||row.querySelector("[data-share-scope-badge]")) return; const badge=document.createElement("span"); badge.className="badge"; badge.dataset.shareScopeBadge="1"; badge.textContent=item.scope==="single"?`单次${item.examName?` · ${item.examName}`:""}`:"高三轨迹"; row.querySelector("strong")?.after(document.createTextNode(" "),badge); });
  } catch {}
}

async function v2EnhanceExternal() {
  const path=location.pathname;
  const kind=path.startsWith("/share/")?"secret":path.startsWith("/p/")?"public":null;
  if (!kind||!document.querySelector(".public-shell")||document.querySelector("[data-trajectory-v2]")) return Boolean(kind);
  const locator=kind==="secret"?path.slice(7):path.slice(3);
  try {
    const result=await v2Api(`/api/share/${kind}/${encodeURIComponent(locator)}`), exams=result.data?.exams||[], first=document.querySelector(".public-shell > .card");
    if (result.share?.scope==="trajectory"&&exams.length>=2&&first) first.insertAdjacentHTML("afterend",v2Summary(exams,true));
    if (result.share?.scope==="single"&&first&&!first.querySelector("[data-single-share-badge]")) { const badge=document.createElement("span"); badge.className="badge"; badge.dataset.singleShareBadge="1"; badge.textContent="单次考试分享"; first.querySelector(".eyebrow")?.after(badge); }
  } catch {}
  return true;
}

async function v2EnhancePrivate() {
  const {student}=await v2Context(); if(!student) return;
  const active=document.querySelector(".tab.active")?.dataset.tab;
  if (active!=="overview"&&active!=="sharing") return;
  const exams=await v2CurrentExams(student.id);
  if (active==="overview"&&exams.length>=2&&!document.querySelector("[data-trajectory-v2]")) document.querySelector("main.container .hero")?.insertAdjacentHTML("afterend",v2Summary(exams));
  if (active==="sharing") await v2EnhanceSharing(exams);
}

async function v2Enhance() {
  if (v2Enhancing) return;
  v2Enhancing=true;
  try { if(await v2EnhanceExternal()) return; if(document.querySelector("main.container .tabs")) await v2EnhancePrivate(); } catch {} finally { v2Enhancing=false; }
}

document.addEventListener("click",(event)=>{
  const button=event.target.closest?.("[data-action='create-secret'],[data-action='create-public']");
  if(!button||!document.querySelector("[data-share-scope-box]")) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const kind=button.dataset.action==="create-public"?"public":"secret"; button.disabled=true;
  v2CreateShare(kind).catch((error)=>{ button.disabled=false; const box=document.createElement("div"); box.className="error-box"; box.textContent=error.message; button.closest("section")?.querySelector(".section-head")?.after(box); });
},true);

const v2Root=document.querySelector("#app");
if(v2Root) new MutationObserver(()=>queueMicrotask(v2Enhance)).observe(v2Root,{childList:true});
v2Enhance();
