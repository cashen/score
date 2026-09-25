import test from "node:test";
import assert from "node:assert/strict";
import { SHARE_DOMAIN_VERSION } from "../src/domain/share-projection.js";
test("share projection has a dedicated domain boundary", () => { assert.equal(SHARE_DOMAIN_VERSION, "0.13.0"); });
