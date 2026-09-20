import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const onboarding = await readFile(new URL("../src/onboarding.js", import.meta.url), "utf8");
const index = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");

test("release is v0.12.28.19 across package and Worker contracts", () => {
  assert.equal(pkg.version, "0.12.28.19");
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[""].version, pkg.version);
  assert.match(wrangler, /^APP_VERSION\s*=\s*"0\.12\.28\.19"\s*$/m);
});

test("recovery-code reset consumes its one-time claim after the member mutation", () => {
  const start = onboarding.indexOf('async function handleRecoveryCodeReset');
  const end = onboarding.indexOf('async function handleRecoveryLinkCreate');
  const source = onboarding.slice(start, end);
  assert.match(source, /claimOneTime\(env, "recovery-code", recoveryLocator\)/);
  assert.match(source, /consumeOneTime\(env, "recovery-code", recoveryLocator, claimId\)/);
  assert.match(source, /releaseOneTime\(env, "recovery-code", recoveryLocator, claimId\)/);
  assert.ok(source.indexOf("await putJson(env, `member:${member.id}`, updated);") < source.indexOf('consumeOneTime(env, "recovery-code"'));
});

test("recovery-link reset consumes its one-time claim after all state writes", () => {
  const start = onboarding.indexOf('async function handleRecoveryLinkReset');
  const end = onboarding.indexOf('export async function routePublicOnboarding');
  const source = onboarding.slice(start, end);
  assert.match(source, /claimOneTime\(env, "recovery-link", found.locator\)/);
  assert.match(source, /consumeOneTime\(env, "recovery-link", found.locator, claimId\)/);
  assert.match(source, /releaseOneTime\(env, "recovery-link", found.locator, claimId\)/);
  const memberWrite = source.indexOf("await putJson(env, `member:${member.id}`, updated);");
  const linkWrite = source.indexOf("await putJson(env, `recovery-link:${found.locator}`,");
  const consume = source.indexOf('consumeOneTime(env, "recovery-link"');
  assert.ok(memberWrite >= 0 && linkWrite > memberWrite && consume > linkWrite);
});

test("password change has one KDF policy source", () => {
  const start = index.indexOf("async function handleChangePassword");
  const end = index.indexOf("async function handleLogoutAll");
  const source = index.slice(start, end);
  assert.doesNotMatch(source, /const iterations\s*=\s*Math\.max/);
  assert.match(source, /passwordIterations\(env\)/);
});
