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
  const exams = count === 2 ? [exam, { ...exam, id: "fixture-0", name: "八月校考", date: "2026-08-01", overall: { officialScore: 570, rankings } }] : count ? [exam] : [];
  const data = publicProjection({ displayName: "示例同学", graduationYear: 2027, schoolLabel: "示例学校", className: "高三一班", notes: "PRIVATE_STUDENT_NOTE" }, exams, allowed);
  await page.route("**/api/**", route => {
    if (/\/api\/share\/(secret|public)\/fixture$/.test(route.request().url())) return route.fulfill({ json: { share: { mode }, data } });
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
  await expect(page.getByText("当前基线", { exact: true })).toBeVisible();
  await expect(page.locator(".subject-row")).toHaveCount(6);
  await layout(page);
  await info.attach("total", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await page.getByRole("link", { name: "单科", exact: true }).click();
  for (const label of labels) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page.getByRole("heading", { name: `${label}的历次记录` })).toBeVisible();
    await expect(page.locator(".subject-compare-row")).toHaveCount(1);
    await expect(page.getByText("当前基线", { exact: true })).toBeVisible();
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
  await page.getByRole("link", { name: "单科", exact: true }).click();
  await expect(page.locator(".subject-compare-row")).toHaveCount(2);
  await expect(page.locator(".public-baseline-note")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("empty share remains navigable without a fabricated baseline", async ({ page }) => {
  await fixture(page, 0);
  await page.goto("/share/fixture");
  for (const view of ["总成绩", "单科", "时间轴"]) {
    await page.getByRole("link", { name: view, exact: true }).click();
    await expect(page.locator(".public-baseline-note")).toHaveCount(0);
    await expect(page.locator(".public-shell")).toContainText(/暂未分享考试数据|还没有可分享/);
    await layout(page);
  }
});

test("whitelist omissions and snapshot semantics are respected", async ({ page }) => {
  await fixture(page, 1, { displayName: true }, "snapshot");
  await page.goto("/share/fixture");
  await expect(page.getByText("只分享当前内容", { exact: true })).toBeVisible();
  await expect(page.locator(".coordinate-row")).toHaveText("位置未分享");
  await page.getByRole("link", { name: "时间轴", exact: true }).click();
  await page.locator(".history-row").click();
  await expect(page.locator(".exam-detail-overall")).toContainText("总分待补");
  await expect(page.locator(".exam-detail-subject").first()).toContainText("分数待补");
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/PRIVATE_|585|校第 123|高三一班|示例学校/);
  await layout(page);
});

test("keyboard focus and navigation have visible current state", async ({ page }) => {
  await fixture(page);
  await page.goto("/share/fixture");
  await expect(page.locator(".public-shell")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "总成绩", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  const subject = page.getByRole("link", { name: "单科", exact: true });
  await expect(subject).toBeFocused();
  expect(await subject.evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "语文的历次记录" })).toBeVisible();
  await expect(page.getByRole("link", { name: "单科", exact: true })).toHaveAttribute("aria-current", "page");
});

test("reduced motion and high contrast keep content and controls usable", async ({ page }) => {
  await fixture(page);
  await page.emulateMedia({ reducedMotion: "reduce", contrast: "more" });
  await page.goto("/share/fixture?view=timeline&exam=fixture-1");
  await expect(page.locator(".exam-detail-subject")).toHaveCount(6);
  expect(await page.locator(".share-ink-root").evaluate(node => getComputedStyle(node).backgroundImage)).toBe("none");
  expect(await page.locator(".public-view-tab").first().evaluate(node => getComputedStyle(node).transitionDuration)).toBe("0s");
  await layout(page);
});
