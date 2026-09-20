const CLAIM_TTL_SECONDS = 120;

function gateMissingError() {
  return Object.assign(new Error("一次性凭证安全组件尚未配置"), {
    status: 500,
    code: "one_time_gate_missing"
  });
}

function gateName(kind, locator) {
  return "v1:" + kind + ":" + locator;
}

function stubFor(env, kind, locator) {
  if (!env.ONE_TIME_GATE || typeof env.ONE_TIME_GATE.getByName !== "function") throw gateMissingError();
  return env.ONE_TIME_GATE.getByName(gateName(kind, locator));
}

export async function claimOneTime(env, kind, locator) {
  const claimId = await stubFor(env, kind, locator).claim();
  return claimId || null;
}

export async function consumeOneTime(env, kind, locator, claimId) {
  return Boolean(await stubFor(env, kind, locator).consume(claimId));
}

export async function releaseOneTime(env, kind, locator, claimId) {
  return Boolean(await stubFor(env, kind, locator).release(claimId));
}

export { CLAIM_TTL_SECONDS };