const path = location.pathname;
const onboarding = path === "/forgot" || path.startsWith("/join/") || path.startsWith("/recover/");

if (onboarding) import("./onboarding-v2.js");
else import("./app.js");
