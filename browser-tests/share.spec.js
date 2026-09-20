import { test, expect } from "@playwright/test";
import { publicProjection } from "../src/lib/model.js";

const keys = ["chinese", "math", "english", "physics", "chemistry", "biology"];
const labels = ["语文", "数学", "英语", "物理", "化学", "生物"];
const rankings = [{ scope: "school", rank: 123, participants: 900 }, { scope: "class", rank: 12, participants: 45 }];
const exam = {
  id: "fixture-1", name: "九月月考（虚构验收数据）", date: "2026-09-01", type: "monthly", notes: "PRIVATE_EXAM_NOTE",
  overall: { officialScore: 585, rankings },
  subjects: Object.fromEntries(keys.map((key, i) => [key, { rawScore: i < 3 ? 110 + i : 80 + i, fullScore: i < 3 ? 150 : 100, scoreMode: "raw", rankings }]))
};
const fields = { displayName: true, graduationYear: true, school: true, className: true, overallScore: true, overallRank: true, subjectScores: true, subjectRanks: true, history: true };

async function fixture(page, count = 1, allowed = fields, mode = "live") {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const exams = count === 2 ? [exam, { ...exam, id: "fixture-0", name: "八月校考", date: "2026-08-01", overall: { officialScore: 570, rankings }, subjects: { ...exam.subjects, english: { ...exam.subjects.english, rawScore: 105 } } }] : count ? [exam] : [];
  const data = publicProjection({ displayName: "示例同学", graduationYear: 2027, schoolLabel: "示例学校", className: "高三一班", notes: "PRIVATE_STUDENT_NOTE" }, exams, allowed);
  await page.route("**/api/**", route => {
    if (/\/api\/share\/(secret|public)\/fixture$/.test(route.request().url())) return route.fulfill({ json: { share: { mode, fields: allowed }, data } });
    return route.abort();
  });
  return errors;
}

async function layout(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const controls = await page.locator(".public-view-tab, .subject-chip, .history-row").evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: rect.height, right: rect.right, left: rect.left };
  }));
  for (const box of controls) {
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(page.viewportSize().width + 1);
  }
  const detailRows = await page.locator(".exam-detail-subject").evaluateAll(nodes => nodes.map(node => {
    const label = node.querySelector("strong");
    const value = node.querySelector("span");
    return { labelWidth: label.getBoundingClientRect().width, fontSize: parseFloat(getComputedStyle(label).fontSize), gap: value.getBoundingClientRect().left - label.getBoundingClientRect().right };
  }));
  for (const row of detailRows) {
    expect(row.labelWidth).toBeGreaterThanOrEqual(row.fontSize * 2 - 1);
    expect(row.gap).toBeGreaterThanOrEqual(10);
  }
  const arrows = await page.locator(".history-row").evaluateAll(nodes => nodes.map(node => {
    const row = node.getBoundingClientRect();
    const arrow = node.querySelector(".row-chevron").getBoundingClientRect();
    return { rightGap: row.right - arrow.right, centerDelta: Math.abs((row.top + row.bottom - arrow.top - arrow.bottom) / 2) };
  }));
  for (const arrow of arrows) {
    expect(arrow.rightGap).toBeLessThanOrEqual(20);
    expect(arrow.centerDelta).toBeLessThanOrEqual(3);
  }
}

test("single record: total, six subjects, timeline and complete detail", async ({ page }, info) => {
  const errors = await fixture(page);
  await page.goto("/share/fixture");
  await expect(page.getByRole("heading", { name: "示例同学" })).toBeVisible();
  await expect(page.locator(".coordinate-row")).toContainText("585 分");
  await expect(page.getByText("目前的记录", { exact: true })).toBeVisible();
  await expect(page.locator(".subject-row")).toHaveCount(6);
  await layout(page);
  await info.attach("total", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await page.getByRole("link", { name: "单科", exact: true }).click();
  await expect(page.getByRole("heading", { name: "六科概览" })).toBeVisible();
  await expect(page.locator(".subject-row")).toHaveCount(6);
  for (const label of labels) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page.getByRole("heading", { name: `${label}的历次记录` })).toBeVisible();
    await expect(page.locator(".subject-compare-row")).toHaveCount(1);
    await expect(page.getByText("目前的记录", { exact: true })).toBeVisible();
    await layout(page);
  }
  await info.attach("subject", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await page.getByRole("link", { name: "时间轴", exact: true }).click();
  await expect(page.locator(".history-row")).toHaveCount(1);
  await page.locator(".history-row").click();
  await expect(page.locator(".public-exam-detail h2")).toHaveText(exam.name);
  await expect(page.locator(".exam-detail-subject")).toHaveCount(6);
  await expect(page.locator(".exam-detail-subject").first()).toContainText("满分 150");
  await expect(page.locator(".exam-detail-overall")).toContainText("585 分");
  await layout(page);
  await info.attach("timeline-detail", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await page.reload();
  await expect(page.locator(".public-exam-detail h2")).toHaveText(exam.name);
  await page.goBack();
  await expect(page.locator(".public-exam-detail")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("public multi-record deep links preserve each examination", async ({ page }) => {
  const errors = await fixture(page, 2);
  await page.goto("/p/fixture?view=timeline");
  await expect(page.locator(".history-row")).toHaveCount(2);
  await expect(page.locator(".public-baseline-note")).toHaveCount(0);
  await page.getByRole("link", { name: /八月校考/ }).click();
  await expect(page.locator(".public-exam-detail h2")).toHaveText("八月校考");
  await expect(page.locator(".exam-detail-overall")).toContainText("570 分");
  await layout(page);
  await expect(page.locator(".history-row").first()).toContainText("最近一次考试");
  const totalText = await page.locator(".public-shell").innerText();
  expect(totalText).not.toContain("同口径");
  expect(totalText).not.toContain("可比考试");
  expect(totalText).not.toContain("最新记录");
  await page.getByRole("link", { name: "总成绩", exact: true }).click();
  await expect(page.getByText("比上一场高 15 分", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "单科", exact: true }).click();
  await expect(page.getByRole("heading", { name: "六科概览" })).toBeVisible();
  await expect(page.locator(".subject-row")).toHaveCount(6);
  await page.getByRole("link", { name: "英语", exact: true }).click();
  await expect(page.getByRole("heading", { name: "英语的历次记录" })).toBeVisible();
  await expect(page.getByText("分数高 7 分", { exact: true })).toBeVisible();