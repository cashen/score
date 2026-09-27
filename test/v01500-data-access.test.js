import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("v0.15 canonical exam reads no longer enumerate summary keys", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  assert.match(source, /getManyJson\\(env, keys\\)/);
  assert.match(source, /exam-index/);
  assert.match(source, /exam-trash-index/);
  assert.doesNotMatch(source, /await listKeys\\(env/);
});

test("v0.15 production binds the serialized student index writer", async () => {
  const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");
  const entry = await readFile(new URL("../src/v020.js", import.meta.url), "utf8");
  assert.match(wrangler, /name = "STUDENT_INDEX"\\nclass_name = "StudentIndexCoordinator"/);
  assert.match(wrangler, /tag = "v2"\\nnew_sqlite_classes = \\["StudentIndexCoordinator"\\]/);
  assert.match(entry, /export \\{ StudentIndexCoordinator \\} from ".\\/student-index-coordinator.js";/);
});

test("v0.15 active index writes stop duplicating per-exam summary keys", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /putJson\\(env,.*exam-summary:/);
  assert.match(source, /mutateExamIndexes\\(env, studentId, "upsert-active", examSummary\\(exam\\)\\)/);
});
