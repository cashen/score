let mounting = false;

function esc(value = "") {
  return String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}

async function request(path, options = {}, csrf = null) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (csrf && !["GET", "HEAD"].includes((options.method || "GET").toUpperCase())) headers.set("x-score-csrf", csrf);
  const response = await fetch(path, { credentials: "same-origin", ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `请求失败 (${response.status})`);
    error.status = response.status;
    error.code = payload.error;
    throw error;
  }
  return payload;
}

function roleLabel(role) {
  return role === "owner" ? "家庭管理员" : role === "editor" ? "可编辑" : "仅查看";
}

function memberRow(member, canManage) {
  const disabled = Boolean(member.disabledAt);
  const status = disabled ? `<span class="badge badge-warn">已停用</span>` : `<span class="badge">可登录</span>`;
  const current = member.isCurrent ? `<span class="badge">当前账号</span>` : "";
  const controls = canManage && !member.isCurrent && member.role !== "owner"
    ? `<div class="family-member-actions"><select data-member-role="${esc(member.id)}" aria-label="${esc(member.username)} 的权限"><option value="editor" ${member.role === "editor" ? "selected" : ""}>可编辑</option><option value="viewer" ${member.role === "viewer" ? "selected" : ""}>仅查看</option></select><button type="button" class="btn btn-outline btn-small" data-member-toggle="${esc(member.id)}" data-enabled="${disabled ? "false" : "true"}">${disabled ? "恢复登录" : "停用登录"}</button></div>`
    : "";
  return `<div class="family-member-row" data-member-row="${esc(member.id)}"><div><div class="family-member-name"><strong>${esc(member.username)}</strong>${current}${status}</div><small>${roleLabel(member.role)}${member.createdAt ? ` · 创建于 ${esc(member.createdAt.slice(0, 10))}` : ""}</small></div>${controls}</div>`;
}

function studentRow(student, currentId) {
  const current = student.id === currentId ? `<span class="badge">当前查看</span>` : "";
  const meta = [student.schoolLabel, student.className, student.graduationYear ? `${student.graduationYear}届` : null].filter(Boolean).map(esc).join(" · ");
  return `<div class="family-student-row"><div><strong>${esc(student.displayName || "孩子")}</strong>${current}</div><small>${meta || "资料可稍后补充"}</small></div>`;
}

function panelHtml(me, members) {
  const role = me.member?.role || "viewer";
  const isOwner = role === "owner";
  const canEdit = role === "owner" || role === "editor";
  const memberCreate = isOwner ? `<form id="family-member-create" class="family-inline-form"><div class="field"><label>新成员账号</label><input name="username" required minlength="3" maxlength="64" autocomplete="off" placeholder="例如 parent02"></div><div class="field"><label>初始密码</label><input name="password" type="password" required minlength="10" maxlength="256" autocomplete="new-password" placeholder="至少 10 个字符"></div><div class="field"><label>权限</label><select name="role"><option value="editor">可编辑成绩</option><option value="viewer">仅查看</option></select></div><div class="family-form-action"><button class="btn btn-primary" type="submit">创建家庭成员</button></div></form>` : `<p class="muted family-permission-note">只有家庭管理员可以新增或停用登录成员。</p>`;
  const studentCreate = canEdit ? `<form id="family-student-create" class="family-student-form"><div class="field"><label>孩子昵称</label><input name="displayName" required maxlength="50" placeholder="例如 小王"></div><div class="field"><label>毕业年份（可空）</label><input name="graduationYear" inputmode="numeric" placeholder="例如 2027"></div><div class="field"><label>年级</label><input name="grade" value="高三" maxlength="30"></div><div class="field"><label>学校（可空）</label><input name="schoolLabel" maxlength="100"></div><div class="field"><label>班级（可空）</label><input name="className" maxlength="60"></div><div class="field"><label>选科</label><input name="subjectTrack" value="物化生" maxlength="50"></div><div class="family-form-action"><button class="btn btn-primary" type="submit">添加孩子</button></div></form>` : `<p class="muted family-permission-note">当前账号只有查看权限，不能新增或修改孩子资料。</p>`;

  return `<div class="family-management"><div id="family-management-notice" aria-live="polite"></div><section class="card card-pad family-management-card"><div class="section-head"><div><div class="eyebrow">同一个家庭</div><h2>家庭成员</h2><div class="muted">每个人用自己的账号登录。这里不是创建新的独立家庭。</div></div><span class="badge">你是：${roleLabel(role)}</span></div><div class="family-member-list">${members.map((member) => memberRow(member, isOwner)).join("") || `<div class="empty">暂无成员资料。</div>`}</div>${memberCreate}</section><section class="card card-pad family-management-card"><div class="section-head"><div><div class="eyebrow">孩子资料</div><h2>家庭里的孩子</h2><div class="muted">添加后会出现在页面顶部的孩子切换器中，每个孩子的考试和分享数据彼此分开。</div></div><span class="badge">${me.students?.length || 0} 个</span></div><div class="family-student-list">${(me.students || []).map((student) => studentRow(student, document.querySelector("#student-select")?.value || null)).join("")}</div>${studentCreate}</section></div>`;
}

function setNotice(message, kind = "notice") {
  const target = document.querySelector("#family-management-notice");
  if (!target) return;
  target.innerHTML = message ? `<div class="${kind === "error" ? "error-box" : "notice-box"}">${esc(message)}</div>` : "";
}

async function refreshMemberList(me, csrf) {
  const result = await request("/api/family/members");
  const list = document.querySelector(".family-member-list");
  if (!list) return;
  list.innerHTML = (result.members || []).map((member) => memberRow(member, me.member.role === "owner")).join("");
  bindMemberActions(me, csrf);
}

function bindMemberActions(me, csrf) {
  document.querySelectorAll("[data-member-role]").forEach((select) => {
    select.addEventListener("change", async () => {
      try {
        await request(`/api/family/members/${encodeURIComponent(select.dataset.memberRole)}`, { method: "PATCH", body: JSON.stringify({ role: select.value }) }, csrf);
        setNotice("成员权限已更新；该成员原有登录会话已经失效。请让对方重新登录。");
        await refreshMemberList(me, csrf);
      } catch (error) {
        setNotice(error.message, "error");
      }
    });
  });
  document.querySelectorAll("[data-member-toggle]").forEach((button) => {
    button.addEventListener("click", async () => {
      const currentlyEnabled = button.dataset.enabled === "true";
      const action = currentlyEnabled ? "停用" : "恢复";
      if (!confirm(`${action}这个家庭成员的登录权限？`)) return;
      try {
        await request(`/api/family/members/${encodeURIComponent(button.dataset.memberToggle)}`, { method: "PATCH", body: JSON.stringify({ enabled: !currentlyEnabled }) }, csrf);
        setNotice(currentlyEnabled ? "成员已停用，已有登录会话同时失效。" : "成员登录权限已恢复。");
        await refreshMemberList(me, csrf);
      } catch (error) {
        setNotice(error.message, "error");
      }
    });
  });
}

async function mount() {
  const profileForm = document.querySelector("#profile-form");
  if (!profileForm || profileForm.dataset.familyManagementMounted === "1" || mounting) return;
  mounting = true;
  profileForm.dataset.familyManagementMounted = "1";
  try {
    const me = await request("/api/me");
    const memberResult = await request("/api/family/members");
    const settingsSection = profileForm.closest("section");
    const settingsGrid = profileForm.closest(".settings-grid");
    if (!settingsSection || !settingsGrid || !document.contains(profileForm)) return;

    settingsSection.querySelector(".section-head h2")?.replaceChildren("家庭与账号");
    const holder = document.createElement("div");
    holder.innerHTML = panelHtml(me, memberResult.members || []);
    settingsGrid.before(holder.firstElementChild);

    if (me.member.role === "viewer") {
      profileForm.querySelectorAll("input, select, textarea, button").forEach((control) => { control.disabled = true; });
      const note = document.createElement("div");
      note.className = "notice-box family-readonly-note";
      note.textContent = "当前账号为“仅查看”，孩子资料和成绩不能修改。";
      profileForm.prepend(note);
    }

    const memberForm = document.querySelector("#family-member-create");
    memberForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(memberForm);
      const button = memberForm.querySelector("button[type='submit']");
      button.disabled = true;
      try {
        await request("/api/family/members", { method: "POST", body: JSON.stringify({ username: form.get("username"), password: form.get("password"), role: form.get("role") }) }, me.csrf);
        memberForm.reset();
        memberForm.querySelector("select[name='role']").value = "editor";
        setNotice("家庭成员已创建。把账号和你刚设置的初始密码单独告诉对方即可。");
        await refreshMemberList(me, me.csrf);
      } catch (error) {
        setNotice(error.message, "error");
      } finally {
        button.disabled = false;
      }
    });

    const studentForm = document.querySelector("#family-student-create");
    studentForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = Object.fromEntries(new FormData(studentForm).entries());
      const button = studentForm.querySelector("button[type='submit']");
      button.disabled = true;
      try {
        const result = await request("/api/family/students", { method: "POST", body: JSON.stringify(form) }, me.csrf);
        setNotice(`“${result.student.displayName}”已加入这个家庭，正在刷新孩子列表。`);
        setTimeout(() => location.reload(), 450);
      } catch (error) {
        setNotice(error.message, "error");
        button.disabled = false;
      }
    });

    bindMemberActions(me, me.csrf);
  } catch (error) {
    profileForm.dataset.familyManagementMounted = "";
  } finally {
    mounting = false;
  }
}

const observer = new MutationObserver(mount);
observer.observe(document.documentElement, { childList: true, subtree: true });
mount();
