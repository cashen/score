import { test, expect } from "@playwright/test";

function me(students) {
  return { csrf: "browser-test-csrf", recoveryReady: true, member: { role: "owner" }, family: { id: "family-test" }, students };
}

function exam(id) {
  return { id, name: "9月月考", date: "2026-09-27", type: "monthly", subjectSet: ["physics"], subjects: { physics: { rawScore: 82, rankings: [] } }, overall: { rankings: [] }, status: "normal", attendance: "present", condition: "normal", revision: 1 };
}

test("exam list opens a readable detail before editing", async ({ page }) => {
  await page.route("**/api/**", async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.pathname === "/api/me") return route.fulfill({ json: me([{ id: "student-a", displayName: "小王", graduationYear: 2027, schoolLabel: "测试学校", className: "高三1班", grade: "高三", subjectTrack: "物化生" }]) });
    if (url.pathname === "/api/students/student-a/exams" && request.method() === "GET") return route.fulfill({ json: { exams: [exam("exam-a")] } });
    if (url.pathname === "/api/students/student-a/exams/trash") return route.fulfill({ json: { exams: [] } });
    return route.abort();
  });
  await page.goto("/?tab=exams");
  await page.locator("[data-action=\"view-exam\"]").first().click();
  await expect(page).toHaveURL(/view=timeline&exam=exam-a/);
  await expect(page.locator(".exam-detail")).toBeVisible();
  await expect(page.locator("#exam-form")).toHaveCount(0);
  await expect(page.locator(".exam-detail [data-action=\"edit-exam\"]")).toBeVisible();
});

test("student switch failure preserves the previous child", async ({ page }) => {
  await page.route("**/api/**", async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.pathname === "/api/me") return route.fulfill({ json: me([{ id: "student-a", displayName: "小王", graduationYear: 2027, schoolLabel: "测试学校", className: "高三1班", grade: "高三", subjectTrack: "物化生" }, { id: "student-b", displayName: "小李", graduationYear: 2027, schoolLabel: "测试学校", className: "高三2班", grade: "高三", subjectTrack: "物化生" }]) });
    if (url.pathname === "/api/students/student-a/exams" && request.method() === "GET") return route.fulfill({ json: { exams: [exam("exam-a")] } });
    if (url.pathname === "/api/students/student-b/exams" && request.method() === "GET") return route.fulfill({ status: 503, json: { message: "暂时无法读取" } });
    return route.abort();
  });
  await page.goto("/");
  await page.locator("#student-select").selectOption("student-b");
  await expect(page.locator(".status-region")).toContainText("暂时无法切换到");
  await expect(page.locator("#student-select")).toHaveValue("student-a");
  await expect(page.locator(".home-welcome h1")).toContainText("小王");
});

test("absent exam can be submitted without a subject", async ({ page }) => {
  let payload = null;
  await page.route("**/api/**", async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.pathname === "/api/me") return route.fulfill({ json: me([{ id: "student-a", displayName: "小王", grade: "高三", subjectTrack: "物化生" }]) });
    if (url.pathname === "/api/students/student-a/exams" && request.method() === "GET") return route.fulfill({ json: { exams: [] } });
    if (url.pathname === "/api/students/student-a/exams" && request.method() === "POST") { payload = request.postDataJSON(); return route.fulfill({ json: { exam: { ...payload, id: "absent-exam", revision: 1 } } }); }
    return route.abort();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "记录第一次考试" }).click();
  await page.locator("[name=\"attendance\"]").selectOption("absent");
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "检查并保存" }).click();
  await expect.poll(() => payload).not.toBeNull();
  expect(payload.attendance).toBe("absent");
  expect(payload.subjectSet).toEqual([]);
});

test("login failure retains the account name", async ({ page }) => {
  await page.route("**/api/me", route => route.fulfill({ status: 401, json: { message: "未登录" } }));
  await page.route("**/api/login", route => route.fulfill({ status: 401, json: { message: "账号或密码不正确" } }));
  await page.goto("/");
  await page.locator("[name=\"username\"]").fill("example-user");
  await page.locator("[name=\"password\"]").fill("1234567890");
  await page.locator("#login-form").evaluate(form => form.requestSubmit());
  await expect(page.locator("[name=\"username\"]")).toHaveValue("example-user");
  await expect(page.locator("[role=\"alert\"]")).toContainText("账号或密码不正确");
});
