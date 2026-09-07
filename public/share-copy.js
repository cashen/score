function extractShareUrl(text) {
  const match = String(text || "").match(/https?:\/\/[^\s；]+\/(?:share|p)\/[^\s；]+/i);
  return match?.[0] || null;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (!ok) throw new Error("copy_failed");
}

function bindCopyButton(button, url) {
  if (!button || button.dataset.copyBound === "1") return;
  button.dataset.copyBound = "1";
  button.addEventListener("click", async () => {
    const original = button.textContent;
    try {
      await copyText(url);
      button.textContent = "已复制";
      button.setAttribute("aria-live", "polite");
    } catch {
      button.textContent = "复制失败";
    }
    setTimeout(() => { button.textContent = original; }, 1800);
  });
}

function enhanceCreationNotice() {
  const notice = document.querySelector(".notice-box");
  if (!notice || notice.querySelector("[data-share-copy-notice]")) return;
  const url = extractShareUrl(notice.textContent);
  if (!url) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-outline btn-small";
  button.dataset.shareCopyNotice = "1";
  button.textContent = "复制链接";
  button.style.marginLeft = "8px";
  bindCopyButton(button, url);
  notice.append(button);
}

function enhancePublicShareRows() {
  document.querySelectorAll(".share-item").forEach((row) => {
    if (row.querySelector("[data-share-copy-row]")) return;
    const text = row.textContent || "";
    const match = text.match(/\/p\/([a-z0-9-]{3,50})\b/i);
    if (!match) return;
    const url = `${location.origin}/p/${match[1].toLowerCase()}`;
    const revoke = row.querySelector("[data-action='revoke-share']");
    if (!revoke) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-outline btn-small";
    button.dataset.shareCopyRow = "1";
    button.textContent = "复制链接";
    bindCopyButton(button, url);
    revoke.before(button);
  });
}

function scan() {
  enhanceCreationNotice();
  enhancePublicShareRows();
}

const root = document.querySelector("#app");
if (root) new MutationObserver(scan).observe(root, { childList: true });
scan();
