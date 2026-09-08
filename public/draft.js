const DB_NAME = "score-local-drafts";
const STORE = "drafts";
const VERSION = 2;
let activeForm = null;
let activeKey = null;
let timer = null;
let submittedAt = 0;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readDraft(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

async function writeDraft(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  }).finally(() => db.close());
}

async function deleteDraft(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  }).finally(() => db.close());
}

function setDraftState(form, text) {
  const target = form?.querySelector?.("[data-draft-state]");
  if (target) target.textContent = text;
}

function studentKey() {
  const familyId = document.body?.dataset?.familyId || "unknown-family";
  const studentId = document.body?.dataset?.studentId || document.querySelector("#student-select")?.value || "unknown-student";
  const memberId = document.body?.dataset?.memberId || "unknown-member";
  return `${familyId}:${studentId}:${memberId}`;
}

function draftKey(form) {
  const id = form?.dataset?.examId;
  return `${id ? "exam-edit" : "exam-new"}:${studentKey()}:${id || "new"}`;
}

function isExamForm(form) {
  return form?.id === "exam-form";
}

function serialize(form) {
  return {
    savedAt: new Date().toISOString(),
    values: [...new FormData(form).entries()]
  };
}

function apply(form, draft) {
  if (!draft?.values?.length) return false;
  for (const [name, value] of draft.values) {
    const field = form.elements.namedItem(name);
    if (!field || typeof field.value === "undefined") continue;
    field.value = value;
  }
  setDraftState(form, `已恢复上次未保存的内容 · ${new Date(draft.savedAt).toLocaleString()}`);
  form.dataset.draftRestored = "1";
  form.dispatchEvent(new CustomEvent("score:draft-restored", { bubbles: true }));
  return true;
}

async function attach(form) {
  if (!isExamForm(form) || form === activeForm) return;
  activeForm = form;
  activeKey = draftKey(form);
  try { apply(form, await readDraft(activeKey)); } catch {}
  const save = () => {
    clearTimeout(timer);
    setDraftState(form, "正在保存本机草稿…");
    timer = setTimeout(async () => {
      try {
        await writeDraft(activeKey, serialize(form));
        if (form.isConnected) setDraftState(form, "草稿已保存在本机");
      } catch {
        if (form.isConnected) setDraftState(form, "本机草稿暂未保存");
      }
    }, 250);
  };
  form.addEventListener("input", save);
  form.addEventListener("change", save);
  form.addEventListener("submit", () => { submittedAt = Date.now(); });
}

function scanDialogLifecycle() {
  const form = document.querySelector("#exam-form");
  if (form) attach(form);
  if (!form && activeForm) {
    const key = activeKey;
    const wasSubmittedRecently = Date.now() - submittedAt < 10000;
    activeForm = null;
    activeKey = null;
    clearTimeout(timer);
    if (wasSubmittedRecently && key) deleteDraft(key).catch(() => {});
    submittedAt = 0;
  }
}

const observer = new MutationObserver(scanDialogLifecycle);
observer.observe(document.body, { childList: true });
scanDialogLifecycle();
