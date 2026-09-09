import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./browser-tests",
  testMatch: "**/*.spec.js",
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    ...[360, 390, 768, 1280].map(width => ({ name: `chromium-${width}`, use: { browserName: "chromium", viewport: { width, height: 900 } } })),
    { name: "webkit-390", use: { browserName: "webkit", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }
  ],
  webServer: { command: "node browser-tests/server.mjs", url: "http://127.0.0.1:4173", reuseExistingServer: false }
});
