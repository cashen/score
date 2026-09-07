const PRODUCT_NAME = "高三坐标";
const app = document.querySelector("#app");
const path = location.pathname;

function esc(value = "") {
  return String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}

async function api(pathname, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(pathname, { credentials: "same-origin", cache: "no-store", ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `请求失败 (${response.status})`);
  return payload;
}

async function copyText(text, button) {
  const old = button?.textContent;
  let ok = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      ok = true;
    }
  } catch {}
  if (!ok) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    try { ok = document.execCommand("copy"); } catch {}
    area.remove();
  }
  if (button) {
    button.textContent = ok ? "已复制" : "复制失败";
    setTimeout(() => { button.textContent = old; }, 1600);
  }
}

function shell(title, intro, body) {
  app.innerHTML = `<main class="onboarding-shell"><section class="onboarding-card"><div class="brand-mark">标</div><div class="eyebrow">${PRODUCT_NAME}</div><h1>${esc(title)}</h1><p class="muted">${esc(intro)}</p>${body}</section></main>`;
}

function recoveryResult(code, { loggedIn = false } = {}) {
  return `<div class="recovery-code-box"><strong>新的账户恢复码</strong><code data-recovery-code>${esc(code)}</code><p class="muted">恢复码只显示这一次。请离线保存；生成后旧恢复码立即失效。</p><button type="button" class="btn btn-outline" data-copy-recovery>复制恢复码</button></div><label class="v4-recovery-ack"><input type="checkbox" data-recovery-ack>我已经把恢复码保存到安全的位置</label><div class="onboarding-actions"><button type="button" class="btn btn-primary" data-finish-recovery disabled>${loggedIn ? "进入我的家庭" : "返回登录"}</button></div>`;
}

function bindRecoveryResult(loggedIn) {
  const code = document.querySelector("[data-recovery-code]")?.textContent || "";
  const finish = document.querySelector("[data-finish-recovery]");
  document.querySelector("[data-copy-recovery]")?.addEventListener("click", (event) => copyText(code, event.currentTarget));
  document.querySelector("[data-recovery-ack]")?.addEventListener("change", (event) => { finish.disabled = !event.currentTarget.checked; });
  finish?.addEventListener("click", () => location.replace("/"));
}

async function renderJoin(token) {
  try {
    const info = await api(`/api/invitations/${encodeURIComponent(token)}`);
    shell("建立你的家庭空间", `这是一条一次性邀请，有效期至 ${new Date(info.expiresAt).toLocaleString()}。这里的数据只属于你的家庭，邀请人也无法查看。`, `<form id="join-form"><div class="v4-join-progress"><span>1 家庭</span><span>2 登录账号</span><span>3 孩子</span></div><fieldset class="v4-join-step"><legend>建立家庭</legend><p>先起一个只有你自己看得懂的家庭名称。</p><div class="field"><label>家庭名称</label><input name="familyName" required maxlength="80" placeholder="例如 王家"></div></fieldset><fieldset class="v4-join-step"><legend>创建登录账号</legend><p>每个家庭成员以后都应该使用自己的登录账号。</p><div class="v4-join-fields"><div class="field"><label>登录账号</label><input name="username" required minlength="3" maxlength="64" autocomplete="username"></div><div></div><div class="field"><label>密码</label><input name="password" type="password" required minlength="10" maxlength="256" autocomplete="new-password"><small>至少 10 个字符。</small></div><div class="field"><label>再次输入密码</label><input name="confirmPassword" type="password" required minlength="10" maxlength="256" autocomplete="new-password"></div></div></fieldset><fieldset class="v4-join-step"><legend>孩子资料</legend><p>先填最常用的信息，学校和班级以后仍可修改。</p><div class="v4-join-fields"><div class="field"><label>孩子名字 / 称呼</label><input name="displayName" required maxlength="50"></div><div class="field"><label>毕业年份（可选）</label><input name="graduationYear" inputmode="numeric" placeholder="例如 2027"></div><div class="field"><label>学校（可选）</label><input name="schoolLabel" maxlength="100"></div><div class="field"><label>班级（可选）</label><input name="className" maxlength="60"></div><div class="field"><label>选科</label><input name="subjectTrack" value="物化生" maxlength="50"></div></div></fieldset><div id="join-error" role="alert"></div><div class="v4-join-actions"><button class="btn btn-primary" type="submit">建立家庭空间</button></div></form>`);
    document.querySelector("#join-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const error = document.querySelector("#join-error");
      if (form.get("password") !== form.get("confirmPassword")) {
        error.innerHTML = `<div class="error-box">两次输入的密码不一致。</div>`;
        return;
      }
      const button = event.currentTarget.querySelector("button[type='submit']");
      button.disabled = true;
      button.textContent = "正在建立…";
      try {
        const result = await api(`/api/invitations/${encodeURIComponent(token)}/accept`, {
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
        history.replaceState(null, "", "/");
        shell("家庭空间已经建立", "先保存恢复码，再进入高三坐标。", recoveryResult(result.recoveryCode, { loggedIn: true }));
        bindRecoveryResult(true);
      } catch (errorValue) {
        error.innerHTML = `<div class="error-box">${esc(errorValue.message)}</div>`;
        button.disabled = false;
        button.textContent = "建立家庭空间";
      }
    });
  } catch (error) {
    shell("邀请已失效", error.message, `<div class="onboarding-actions"><a class="btn btn-outline" href="/">返回登录</a></div>`);
  }
}

async function renderRecoveryLink(token) {
  try {
    const info = await api(`/api/recovery/reset/${encodeURIComponent(token)}`);
    shell("设置新密码", `这个一次性地址将在 ${new Date(info.expiresAt).toLocaleString()} 前有效，只能使用一次。`, `<form id="reset-form"><div class="field"><label>新密码</label><input name="newPassword" type="password" required minlength="10" maxlength="256" autocomplete="new-password"></div><div class="field"><label>再次输入新密码</label><input name="confirmPassword" type="password" required minlength="10" maxlength="256" autocomplete="new-password"></div><div id="reset-error" role="alert"></div><div class="onboarding-actions"><button class="btn btn-primary" type="submit">设置新密码</button></div></form>`);
    document.querySelector("#reset-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const error = document.querySelector("#reset-error");
      if (form.get("newPassword") !== form.get("confirmPassword")) {
        error.innerHTML = `<div class="error-box">两次输入的新密码不一致。</div>`;
        return;
      }
      const button = event.currentTarget.querySelector("button[type='submit']");
      button.disabled = true;
      button.textContent = "正在设置…";
      try {
        const result = await api(`/api/recovery/reset/${encodeURIComponent(token)}`, { method: "POST", body: JSON.stringify({ newPassword: form.get("newPassword") }) });
        history.replaceState(null, "", "/");
        shell("密码已经重置", "旧登录会话已经失效。请先保存新的恢复码。", recoveryResult(result.recoveryCode));
        bindRecoveryResult(false);
      } catch (errorValue) {
        error.innerHTML = `<div class="error-box">${esc(errorValue.message)}</div>`;
        button.disabled = false;
        button.textContent = "设置新密码";
      }
    });
  } catch (error) {
    shell("重置地址已失效", error.message, `<div class="onboarding-actions"><a class="btn btn-outline" href="/forgot">使用恢复码找回</a><a class="btn btn-outline" href="/">返回登录</a></div>`);
  }
}

function renderForgot() {
  shell("忘记密码", "如果你保存了账户恢复码，可以直接设置新密码。成功后旧恢复码会失效，并生成一个新的恢复码。", `<form id="forgot-form"><div class="field"><label>登录账号</label><input name="username" required minlength="3" maxlength="64" autocomplete="username"></div><div class="field"><label>账户恢复码</label><input name="recoveryCode" required autocomplete="off"></div><div class="field"><label>新密码</label><input name="newPassword" type="password" required minlength="10" maxlength="256" autocomplete="new-password"></div><div class="field"><label>再次输入新密码</label><input name="confirmPassword" type="password" required minlength="10" maxlength="256" autocomplete="new-password"></div><div id="forgot-error" role="alert"></div><div class="onboarding-actions"><button class="btn btn-primary" type="submit">重置密码</button><a class="btn btn-outline" href="/">返回登录</a></div></form>`);
  document.querySelector("#forgot-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const error = document.querySelector("#forgot-error");
    if (form.get("newPassword") !== form.get("confirmPassword")) {
      error.innerHTML = `<div class="error-box">两次输入的新密码不一致。</div>`;
      return;
    }
    const button = event.currentTarget.querySelector("button[type='submit']");
    button.disabled = true;
    button.textContent = "正在重置…";
    try {
      const result = await api("/api/recovery/code", { method: "POST", body: JSON.stringify({ username: form.get("username"), recoveryCode: form.get("recoveryCode"), newPassword: form.get("newPassword") }) });
      shell("密码已经重置", "旧登录会话已经失效。请先保存新的恢复码。", recoveryResult(result.recoveryCode));
      bindRecoveryResult(false);
    } catch (errorValue) {
      error.innerHTML = `<div class="error-box">${esc(errorValue.message)}</div>`;
      button.disabled = false;
      button.textContent = "重置密码";
    }
  });
}

if (path.startsWith("/join/")) renderJoin(path.slice("/join/".length));
else if (path.startsWith("/recover/")) renderRecoveryLink(path.slice("/recover/".length));
else renderForgot();
