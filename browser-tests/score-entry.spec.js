import { test, expect } from "@playwright/test";

const emptyExams = { exams: [] };

async function mockPrivateApp(page, onCreate = () => {}) {
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/me") {
      return route.fulfill({ json: {
        csrf: "browser-test-csrf",
        recoveryReady: true,
        member: { role: "owner" },
        family: { id: "family-test" },
        students: [{ id: "student-test", displayName: "测试同学", graduationYear: 2027, schoolLabel: "测试学校", className: "高三1班", grade: "高三", subjectTrack: "物化生" }]
      }});
    }
    if (url.pathname === "/api/students/student-test/exams" && route.request().method() === "GET") {
      return route.fulfill({ json: onCreate.current || emptyExams });
    }
    if (url.pathname === "/api/students/student-test/exams" && route.request().method() === "POST") {
      const payload = route.request().postDataJSON();
      onCreate.payload = payload;
      const exam = {
        id: "browser-created-exam",
        name: payload.name,
        date: payload.date,
        type: payload.type,
        subjectSet: payload.subjectSet,
        subjects: payload.subjects,
        overall: payload.overall,
        status: payload.status,
        attendance: payload.attendance,
        condition: payload.condition,
        revision: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      onCreate.current = { exams: [exam] };
      return route.fulfill({ json: { exam } });
    }
    return route.abort();
  });
}

test("score-card entry starts with no forced six-subject selection and adds a detected subject", async ({ page }) => {
  const state = {};
  await mockPrivateApp(page, state);
  await page.goto("/");
  await page.getByRole("button", { name: "记录第一次考试" }).click();
  await expect(page.locator("#exam-dialog")).toBeVisible();

  await expect(page.locator('input[name="subjectSet"]:checked')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "＋ 添加第一科" })).toBeVisible();

  await page.locator('input[name="name"]').fill("英语月考");
  await expect(page.locator("[data-subject-inference]")).toContainText("看起来可能是：英语");
  await page.getByRole("button", { name: "添加" }).click();

  await expect(page.locator('input[name="subjectSet"]:checked')).toHaveCount(1);
  await page.getByRole("button", { name: "下一步" }).click();
  await expect(page.locator('.exam-subject-card[data-subject="english"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "＋ 添加另一科" })).toBeVisible();
  await expect(page.locator('.exam-subject-card:not([hidden])')).toHaveCount(1);
});

test("score-card entry supports previous-exam template, common presets, and saving only selected facts", async ({ page }) => {
  const state = {};
  state.current = {
    exams: [{
      id: "previous-exam",
      name: "上一次月考",
      date: "2026-09-20",
      type: "monthly",
      subjectSet: ["physics", "chemistry", "biology"],
      subjects: { physics: {}, chemistry: {}, biology: {} },
      overall: { rankings: [] },
      status: "normal",
      attendance: "present",
      condition: "normal",
      revision: 1
    }]
  };
  await mockPrivateApp(page, state);
  await page.goto("/");
  await page.locator("[data-action=\"new-exam\"]").first().click();
  await expect(page.locator('[data-subject-template="previous"]')).toBeVisible();
  await page.locator('[data-subject-template="previous"]').click();
  await expect(page.locator('input[name="subjectSet"]:checked')).toHaveCount(3);
  await page.getByRole("button", { name: "下一步" }).click();
  await expect(page.locator('.exam-subject-card:not([hidden])')).toHaveCount(3);

  await page.locator('input[name="name"]').fill("9月27日月考");
  await page.locator('input[name="physics-raw"]').fill("82");
  await page.locator('input[name="chemistry-raw"]').fill("91");
  await page.locator('input[name="biology-raw"]').fill("88");
  await page.getByRole("button", { name: "保存考试" }).click();

  await expect(page.locator("#exam-dialog")).toHaveCount(0);
  await expect(page.locator("[data-status-region]")).toContainText("考试已保存");
  expect(state.payload.subjectSet).toEqual(["physics", "chemistry", "biology"]);
  expect(state.payload.subjects.physics.rawScore).toBe(82);
  expect(state.payload.subjects.chemistry.rawScore).toBe(91);
  expect(state.payload.subjects.biology.rawScore).toBe(88);
});

test("score-card entry keeps touch targets usable on small screens", async ({ page }) => {
  const state = {};
  await mockPrivateApp(page, state);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.locator("[data-action=\"new-exam\"]").first().click();
  const button = page.getByRole("button", { name: "＋ 添加第一科" });
  const box = await button.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
