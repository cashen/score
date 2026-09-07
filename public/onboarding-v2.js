const onboardingApp = document.querySelector("#app");
const onboardingPath = location.pathname;
let onboardingMe = null;
let onboardingEnhancing = false;

function oEsc(value = "") {
  return String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}

async function oApi(path, options = {}, csrf = null) {
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

async function oCopy(text, button) {
  const original = button?.textContent;
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    if (button) button.textContent = "已复制";
  } catch {
    if (button) button.textContent = "复制失败";
  }
  if (button) setTimeout(() => { button.textContent = original; }, 1600);
}

function oShell(title, intro, inner) {
  onboardingApp.innerHTML = `<main class="onboarding-shell"><section class="onboarding-card"><div class="brand-mark">迹</div><div class="eyebrow">高三轨迹</div><h1>${oEsc(title)}</h1><p class="muted">${oEsc(intro)}</p>${inner}</section></main>`;
}

function oRecoveryResult(code, notice, { loggedIn = false } = {}) {
  return `<div class="recovery-code-box"><strong>新的账户恢复码</strong><code data-recovery-code>${oEsc(code)}</code><p class="muted">${oEsc(notice || "恢复码只显示这一次，请离线保存。")}</p><button type="button" class="btn btn-outline" data-copy-recovery>复制恢复码</button></div><div class="onboarding-actions"><button type="button" class="btn btn-primary" data-finish-recovery>${loggedIn ? "已保存，进入我的家庭" : "已保存，返回登录"}</button></div>`;
}

async function renderJoin(token) {
  try {
    const info = await oApi(`/api/invitations/${encodeURIComponent(token)}`);
    oShell("创建一个独立家庭", `这是一条一次性邀请，有效期至 ${new Date(info.expiresAt).toLocaleString()}。创建后你的家庭数据与邀请人完全隔离。`, `<form id="join-family-form"><div class="onboarding-grid"><div class="field"><label>家庭名称</label><input name="familyName" required maxlength="80" placeholder="例如 王家"></div><div class="field"><label>登录账号</label><input name="username" required minlength="3" maxlength="64" autocomplete="username"></div><div class="field"><label>密码</label><input name="password" type="password" required minlength="10" maxlength="256" autocomplete="new-password"></div><div class="field"><label>确认密码</label><input name="confirmPassword" type="password" required minlength="10" maxlength="256" autocomplete="new-password"></div><div class="field"><label>孩子昵称</label><input name="displayName" required maxlength="50"></div><div class="field"><label>毕业年份（可空）</label><input name="graduationYear" inputmode="numeric" placeholder="例如 2027"></div><div class="field"><label>学校（可空）</label><input name="schoolLabel" maxlength="100"></div><div class="field"><label>班级（可空）</label><input name="className" maxlength="60"></div><div class="field full"><label>选科</label><input name="subjectTrack" value="物化生" maxlength="50"></div></div><div id="join-error"></div><div class="onboarding-actions"><button class="btn btn-primary" type="submit">创建我的家庭</button></div></form>`);
    document.querySelector("#join-family-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      if (form.get("password") !== form.get("confirmPassword")) {
        document.querySelector("#join-error").innerHTML = `<div class="error-box">两次输入的密码不一致。</div>`;
        return;
      }
      const button = event.currentTarget.querySelector("button[type='submit']");
      button.disabled = true;
      try {
        const result = await oApi(`/api/invitations/${encodeURIComponent(token)}/accept`, {
          method: "POST",
          body: JSON.stringify({
            familyName: form.get("familyName"),
            username: form.get("username"),
            password: form.get("password"),
            student: {
              displayName: form.get("displayName"),
              graduationYear: form.get("graduationYear"),
              grade: "高三",
              schoolLabel: form.get("schoolLabel"),
              className: form.get("className"),
              subjectTrack: form.get("subjectTrack")
            }
          })
        });
        history.replaceState(null, "", "/app");
        oShell("家庭创建成功", "账号已经建立。先保存恢复码，再进入你的家庭。", oRecoveryResult(result.recoveryCode, result.recoveryCodeNotice, { loggedIn: true }));
        bindRecoveryResult(true);
      } catch (error) {
        document.querySelector("#join-error").innerHTML = `<div class="error-box">${oEsc(error.message)}</div>`;
        button.disabled = false;
      }
    });
  } catch (error) {
    oShell("邀请已失效", error.message, `<div class="onboarding-actions"><a class="btn btn-outline" href="/">返回登录</a></div>`);
  }
}

function bindRecoveryResult(loggedIn) {
  const code = document.querySelector("[data-recovery-code]")?.textContent || "";
  document.querySelector("[data-copy-recovery]")?.addEventListener("click", (event) => oCopy(code, event.currentTarget));
  document.querySelector("[data-finish-recovery]")?.addEventListener("click", () => location.replace(loggedIn ? "/" : "/"));
}

async function renderRecoveryLink(token) {
  try {
    const info = await oApi(`/api/recovery/reset/${encodeURIComponent(token)}`);
    oShell("设置新密码", `这条协助恢复链接将在 ${new Date(info.expiresAt).toLocaleString()} 前有效，只能使用一次。`, `<form id="recovery-link-form"><div class="field"><label>新密码</label><input name="newPassword" type="password" required minlength="10" maxlength="256" autocomplete="new-password"></div><div class="field"><label>确认新密码</label><input name="confirmPassword" type="password" required minlength="10" maxlength="256" autocomplete="new-password"></div><div id="recovery-link-error"></div><div class="onboarding-actions"><button class="btn btn-primary" type="submit">重置密码</button></div></form>`);
    document.querySelector("#recovery-link-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      if (form.get("newPassword") !== form.get("confirmPassword")) {
        document.querySelector("#recovery-link-error").innerHTML = `<div class="error-box">两次输入的密码不一致。</div>`;
        return;
      }
      const button = event.currentTarget.querySelector("button[type='submit']");
      button.disabled = true;
      try {
        const result = await oApi(`/api/recovery/reset/${encodeURIComponent(token)}`, { method: "POST", body: JSON.stringify({ newPassword: form.get("newPassword") }) });
        history.replaceState(null, "", "/");
        oShell("密码已经重置", "所有旧登录会话已经失效。请保存新的恢复码。", oRecoveryResult(result.recoveryCode, result.notice));
        bindRecoveryResult(false);
      } catch (error) {
        document.querySelector("#recovery-link-error").innerHTML = `<div class="error-box">${oEsc(error.message)}</div>`;
        button.disabled = false;
      }
    });
  } catch (error) {
    oShell("重置链接已失效", error.message, `<div class="onboarding-actions"><a class="btn btn-outline" href="/forgot">使用恢复码找回</a><a class="btn btn-outline" href="/">返回登录</a></div>`);
  }
}

function renderForgot() {
  oShell("忘记密码", "如果你保存了账户恢复码，可以在这里直接设置新密码。恢复成功后旧恢复码会失效，并生成新的恢复码。", `<form id="forgot-form"><div class="field"><label>登录账号</label><input name="username" required minlength="3" maxlength="64" autocomplete="username"></div><div class="field"><label>账户恢复码</label><input name="recoveryCode" required autocomplete="off"></div><div class="field"><label>新密码</label><input name="newPassword" type="password" required minlength="10" maxlength="256" autocomplete="new-password"></div><div class="field"><label>确认新密码</label><input name="confirmPassword" type="password" required minlength="10" maxlength="256" autocomplete="new-password"></div><div id="forgot-error"></div><div class="onboarding-actions"><button class="btn btn-primary" type="submit">重置密码</button><a class="btn btn-outline" href="/">返回登录</a></div></form>`);
  document.querySelector("#forgot-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("newPassword") !== form.get("confirmPassword")) {
      document.querySelector("#forgot-error").innerHTML = `<div class="error-box">两次输入的密码不一致。</div>`;
      return;
    }
    const button = event.currentTarget.querySelector("button[type='submit']");
    button.disabled = true;
    try {
      const result = await oApi("/api/recovery/code", { method: "POST", body: JSON.stringify({ username: form.get("username"), recoveryCode: form.get("recoveryCode"), newPassword: form.get("newPassword") }) });
      oShell("密码已经重置", "所有旧登录会话已经失效。请保存新的恢复码。", oRecoveryResult(result.recoveryCode, result.notice));
      bindRecoveryResult(false);
    } catch (error) {
      document.querySelector("#forgot-error").innerHTML = `<div class="error-box">${oEsc(error.message)}</div>`;
      button.disabled = false;
    }
  });
}

function invitationRows(items = []) {
  if (!items.length) return `<div class="empty">还没有发出独立家庭邀请。</div>`;
  return items.map((item) => `<div class="invite-row"><div><strong>${item.usedAt ? "已领取" : new Date(item.expiresAt).getTime() <= Date.now() ? "已过期" : "等待领取"}</strong><div class="muted">创建 ${oEsc(item.createdAt?.slice(0, 10) || "")} · 到期 ${oEsc(item.expiresAt?.slice(0, 10) || "")}</div></div>${item.usedAt ? `<span class="badge">已使用</span>` : `<span class="badge">一次性</span>`}</div>`).join("");
}

async function enhanceLogin() {
  const form = document.querySelector("#login-form");
  if (!form || form.dataset.recoveryLinkAdded === "1") return;
  form.dataset.recoveryLinkAdded = "1";
  const help = document.createElement("div");
  help.className = "login-help";
  help.innerHTML = `<a href="/forgot">忘记密码？使用恢复码</a>`;
  form.after(help);
}

async function enhanceSettings() {
  const profile = document.querySelector("#profile-form");
  if (!profile || profile.dataset.onboardingV2 === "1") return;
  profile.dataset.onboardingV2 = "1";
  try {
    onboardingMe = onboardingMe || await oApi("/api/me");
    const settings = profile.closest("section");
    if (!settings) return;

    const recovery = document.createElement("section");
    recovery.className = "card card-pad account-recovery-panel";
    recovery.innerHTML = `<div class="section-head"><div><div class="eyebrow">账号安全</div><h3>账户恢复码</h3></div></div><p class="muted">用于忘记密码时自助找回。服务器只保存摘要；新的恢复码只显示一次，生成后旧恢复码立即失效。</p><div data-own-recovery-result></div><button type="button" class="btn btn-outline" data-generate-recovery>生成 / 更换恢复码</button>`;
    settings.append(recovery);
    recovery.querySelector("[data-generate-recovery]")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const result = await oApi("/api/me/recovery-code", { method: "POST", body: "{}" }, onboardingMe.csrf);
        recovery.querySelector("[data-own-recovery-result]").innerHTML = `<div class="recovery-code-box"><code>${oEsc(result.recoveryCode)}</code><p class="muted">${oEsc(result.notice)}</p><button type="button" class="btn btn-outline btn-small" data-copy-own>复制恢复码</button></div>`;
        recovery.querySelector("[data-copy-own]")?.addEventListener("click", (copyEvent) => oCopy(result.recoveryCode, copyEvent.currentTarget));
      } catch (error) {
        recovery.querySelector("[data-own-recovery-result]").innerHTML = `<div class="error-box">${oEsc(error.message)}</div>`;
      } finally {
        button.disabled = false;
      }
    });

    if (onboardingMe.member?.role !== "owner") return;
    let inviteData;
    try { inviteData = await oApi("/api/admin/invitations"); } catch { return; }
    const invitePanel = document.createElement("section");
    invitePanel.className = "card card-pad independent-invite-panel";
    invitePanel.innerHTML = `<div class="section-head"><div><div class="eyebrow">独立家庭</div><h3>邀请新家庭</h3></div><span class="badge">邀请制</span></div><p class="muted">对方通过一次性链接自己设置账号、密码和孩子资料。新家庭的数据与你完全隔离，你不能查看对方成绩。</p><div class="invite-tools"><div class="field"><label>邀请有效期</label><select data-invite-hours><option value="24">24 小时</option><option value="72" selected>72 小时</option><option value="168">7 天</option></select></div><button type="button" class="btn btn-primary" data-create-invite>生成邀请链接</button></div><div data-invite-result></div><div class="invite-list" data-invite-list>${invitationRows(inviteData.invitations)}</div><hr style="border:0;border-top:1px solid var(--line);margin:22px 0"><h3>恢复码也丢了</h3><p class="muted">输入你曾邀请的新家庭的登录账号，生成一条 15 分钟一次性重置链接。你看不到对方的新旧密码。</p><div class="invite-tools"><div class="field"><label>对方登录账号</label><input data-recovery-username autocomplete="off"></div><button type="button" class="btn btn-outline" data-create-recovery-link>生成重置链接</button></div><div data-recovery-link-result></div>`;
    settings.append(invitePanel);

    invitePanel.querySelector("[data-create-invite]")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const hours = Number(invitePanel.querySelector("[data-invite-hours]")?.value || 72);
        const result = await oApi("/api/admin/invitations", { method: "POST", body: JSON.stringify({ expiresInHours: hours }) }, onboardingMe.csrf);
        const url = `${location.origin}/join/${result.token}`;
        invitePanel.querySelector("[data-invite-result]").innerHTML = `<div class="generated-link"><strong>邀请链接只需发给对方：</strong><br>${oEsc(url)}<div style="margin-top:8px"><button class="btn btn-outline btn-small" type="button" data-copy-invite>复制链接</button></div></div>`;
        invitePanel.querySelector("[data-copy-invite]")?.addEventListener("click", (copyEvent) => oCopy(url, copyEvent.currentTarget));
        const refreshed = await oApi("/api/admin/invitations");
        invitePanel.querySelector("[data-invite-list]").innerHTML = invitationRows(refreshed.invitations);
      } catch (error) {
        invitePanel.querySelector("[data-invite-result]").innerHTML = `<div class="error-box">${oEsc(error.message)}</div>`;
      } finally {
        button.disabled = false;
      }
    });

    invitePanel.querySelector("[data-create-recovery-link]")?.addEventListener("click", async (event) => {
      const username = invitePanel.querySelector("[data-recovery-username]")?.value?.trim();
      if (!username) return;
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const result = await oApi("/api/admin/recovery-links", { method: "POST", body: JSON.stringify({ username }) }, onboardingMe.csrf);
        const url = `${location.origin}/recover/${result.token}`;
        invitePanel.querySelector("[data-recovery-link-result]").innerHTML = `<div class="generated-link"><strong>15 分钟一次性重置链接：</strong><br>${oEsc(url)}<div style="margin-top:8px"><button class="btn btn-outline btn-small" type="button" data-copy-reset>复制链接</button></div></div>`;
        invitePanel.querySelector("[data-copy-reset]")?.addEventListener("click", (copyEvent) => oCopy(url, copyEvent.currentTarget));
      } catch (error) {
        invitePanel.querySelector("[data-recovery-link-result]").innerHTML = `<div class="error-box">${oEsc(error.message)}</div>`;
      } finally {
        button.disabled = false;
      }
    });
  } catch {}
}

async function enhancePrivateUi() {
  if (onboardingEnhancing) return;
  onboardingEnhancing = true;
  try {
    await enhanceLogin();
    await enhanceSettings();
  } finally {
    onboardingEnhancing = false;
  }
}

if (onboardingPath.startsWith("/join/")) {
  renderJoin(onboardingPath.slice("/join/".length));
} else if (onboardingPath.startsWith("/recover/")) {
  renderRecoveryLink(onboardingPath.slice("/recover/".length));
} else if (onboardingPath === "/forgot") {
  renderForgot();
} else {
  const root = document.querySelector("#app");
  if (root) new MutationObserver(() => queueMicrotask(enhancePrivateUi)).observe(root, { childList: true });
  enhancePrivateUi();
}
