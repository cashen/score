import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");

test("production observability logs are explicitly disabled", () => {
  assert.match(wrangler, /\[observability\.logs\]\s*enabled\s*=\s*false\s*invocation_logs\s*=\s*false/s);
});
