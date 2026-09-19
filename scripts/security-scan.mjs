import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

const tracked = git(["ls-tree", "-r", "--name-only", "HEAD"]).split("\n").filter(Boolean);
const forbiddenTracked = tracked.filter((path) => /(^|\/)(\.env(?:\.[^/]+)?|\.dev\.vars|\.runtime-secrets\.json)$/.test(path));

if (forbiddenTracked.length) {
  console.error("Forbidden secret-bearing files are tracked:");
  for (const path of forbiddenTracked) console.error(path);
  process.exit(1);
}

const historicalSecretFiles = git([
  "log", "--all", "--name-only", "--format=",
  "--", ".env", ".dev.vars", ".runtime-secrets.json", ":(glob)**/.env.*"
]).split("\n").map((line) => line.trim()).filter(Boolean);

if (historicalSecretFiles.length) {
  console.error("Potential historical secret-bearing file detected:");
  for (const path of [...new Set(historicalSecretFiles)]) console.error(path);
  process.exit(1);
}

const credentialNeedles = [
  "CLOUDFLARE_API_TOKEN=",
  "SCORE_SESSION_SECRET=",
  "SCORE_AUTH_PEPPER=",
  "SCORE_ADMIN_BOOTSTRAP_SECRET=",
  "SCORE_TOKEN_PEPPER="
];

for (const needle of credentialNeedles) {
  const history = git([
    "log", "--all", "--format=%H", "-S", needle,
    "--", ":!test/**", ":!tests/**", ":!**/__tests__/**", ":!docs/**", ":!.codex/**", ":!.github/**"
  ]).split("\n").filter(Boolean);
  if (history.length) {
    console.error(`Potential historical credential assignment found for ${needle} in ${history.length} commit(s).`);
    console.error("Review the affected history and rotate any credential that was ever exposed.");
    process.exit(1);
  }
}

const sensitiveLogPatterns = [
  /console\.(?:log|info|debug)\([^\n]*(?:password|recoveryCode|share.*token|invite.*token|score_session)/i,
  /console\.(?:log|info|debug)\([^\n]*authorization/i
];

const serverFiles = ["src/index.js", "src/onboarding.js", "src/sharing-v2.js", "src/family.js", "src/v020.js"];
for (const path of serverFiles) {
  if (!existsSync(path)) continue;
  const source = readFileSync(path, "utf8");
  for (const pattern of sensitiveLogPatterns) {
    if (pattern.test(source)) {
      console.error(`Sensitive logging pattern found in ${path}: ${pattern}`);
      process.exit(1);
    }
  }
}

console.log("Security scan passed: no tracked secret files, historical credential assignments, or obvious sensitive server logging.");
