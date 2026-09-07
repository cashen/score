const path = location.pathname;
const onboarding = path === "/forgot" || path.startsWith("/join/") || path.startsWith("/recover/");

const slowTimer = setTimeout(() => {
  const loading = document.querySelector(".loading-screen p");
  if (loading?.textContent?.includes("正在读取数据")) loading.textContent = "网络有点慢，数据还在读取。";
}, 1500);

try {
  if (onboarding) await import("./onboarding-v050.js");
  else await import("./app.js");
} finally {
  clearTimeout(slowTimer);
}
