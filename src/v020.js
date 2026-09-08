import baseWorker from "./index.js";
import { verifySessionToken } from "./lib/crypto.js";
import { errorJson, parseCookies, withSecurity } from "./lib/http.js";
import { routePrivateOnboarding, routePublicOnboarding } from "./onboarding.js";
import { routePrivateSharingV2, routePublicSharingV2 } from "./sharing-v2.js";

async function getJson(env, key) {
  return env.SCORE_KV.get(key, "json");
}

async function auth(request, env) {
  if (!env.SESSION_SECRET || !env.AUTH_PEPPER) return null;
  const token = parseCookies(request).score_session;
  const payload = await verifySessionToken(token, env.SESSION_SECRET);
  if (!payload) return null;
  const member = await getJson(env, `member:${payload.sub}`);
  if (!member || member.familyId !== payload.fid || member.sessionVersion !== payload.sv || member.disabledAt) return null;
  return { member, payload };
}

function needsPrivateV2(path, method) {
  if (path === "/api/admin/invitations" && (method === "GET" || method === "POST")) return true;
  if (path === "/api/admin/recovery-links" && method === "POST") return true;
  if (path === "/api/me/recovery-code" && method === "POST") return true;
  if (/^\/api\/students\/[^/]+\/shares$/.test(path) && method === "POST") return true;
  return false;
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      if (!path.startsWith("/api/")) return baseWorker.fetch(request, env, ctx);

      const publicOnboarding = await routePublicOnboarding(request, env);
      if (publicOnboarding) return withSecurity(publicOnboarding, { noStore: true });

      const publicShare = await routePublicSharingV2(request, env);
      if (publicShare) return withSecurity(publicShare, { noStore: true });

      if (needsPrivateV2(path, request.method)) {
        const session = await auth(request, env);
        if (!session) return withSecurity(errorJson("请先登录", 401, "unauthorized"), { noStore: true });

        const onboarding = await routePrivateOnboarding(request, env, session);
        if (onboarding) return withSecurity(onboarding, { noStore: true });

        const sharing = await routePrivateSharingV2(request, env, session);
        if (sharing) return withSecurity(sharing, { noStore: true });
      }

      return baseWorker.fetch(request, env, ctx);
    } catch (error) {
      return withSecurity(errorJson(error?.message || "请求处理失败", error?.status || 400, error?.code || "request_failed", error?.field || null), { noStore: true });
    }
  }
};
