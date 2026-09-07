const DB_NAME = "score-local-drafts";
const STORE = "drafts";
const VERSION = 1;
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

function studentKey() {
  const select = document.querySelector("#student-select");
  if (select?.value) return select.value;
  const title = document.querySelector("main.container .title-row h1")?.textContent?.trim();
  return title || "default";
}

function isNewExamForm(form) {
  return form?.id === "exam-form" && form.querySelector(".dialog-head h2")?.textContent?.includes("记录一次考试");
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
  const note = document.createElement("div");
  note.className = "notice-box";
  note.textContent = `已恢复本机未同步草稿 · ${new Date(draft.savedAt).toLocaleString()}`;
  form.querySelector(".dialog-head")?.after(note);
  form.dataset.draftRestored = "1";
  form.dispatchEvent(new CustomEvent("score:draft-restored", { bubbles: true }));
  return true;
}

async function attach(form) {
  if (!isNewExamForm(form) || form === activeForm) return;
  activeForm = form;
  activeKey = `exam-new:${studentKey()}`;
  try { apply(form, await readDraft(activeKey)); } catch {}
  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(() => writeDraft(activeKey, serialize(form)).catch(() => {}), 250);
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