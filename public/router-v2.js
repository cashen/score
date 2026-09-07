const path = location.pathname;
const onboarding = path === "/forgot" || path.startsWith("/join/") || path.startsWith("/recover/");
if (!onboarding) import("./app.js");
