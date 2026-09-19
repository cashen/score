import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCT_LANGUAGE, formatComparisonState, formatMissingSubjects, formatRanking, formatScoreState, formatShareMode } from '../src/lib/product-language.js';

test('score state distinguishes official total, six-subject sum and partial subtotal', () => {
  assert.equal(formatScoreState({ subjectCount: 6 }).label, '六科合计');
  assert.equal(formatScoreState({ subjectCount: 3 }).label, '3/6 科小计');
  assert.equal(formatScoreState({ officialScore: 509.5, subjectCount: 6 }).label, '总分');
});

test('ranking wording always preserves scope', () => {
  assert.equal(formatRanking({ scope: 'school', rank: 2 }), '校内第 2 名');
  assert.equal(formatRanking({ scope: 'class', rank: 1 }), '班级第 1 名');
  assert.equal(formatRanking({ scope: 'joint', rank: 326 }), '联考第 326 名');
});

test('missing subjects are concrete', () => {
  assert.equal(formatMissingSubjects({ subjects: ['语文','数学','英语','物理','化学','生物'], recorded: ['英语'] }), '还缺：语文、数学、物理、化学、生物');
  assert.equal(formatMissingSubjects({ subjects: ['英语'], recorded: ['英语'] }), '');
});

test('comparison never silently falls back to an older comparable exam', () => {
  assert.equal(formatComparisonState({ hasHistory: true, comparable: false, reason: 'different_exam_type' }), '暂时没有可以直接比较的考试。之前有 1 场考试，但考试类型不同。');
  assert.equal(formatComparisonState({ hasHistory: false }), '这是第一次记录。');
});

test('share modes use human descriptions', () => {
  assert.equal(formatShareMode({ mode: 'live' }), '这个分享页面会随着以后新增的考试一起更新。');
  assert.equal(formatShareMode({ mode: 'snapshot' }), '这是创建分享时保存的内容，之后不会变化。');
});

test('prohibited terms are an explicit UI vocabulary list', () => {
  assert.ok(PRODUCT_LANGUAGE.prohibitedUiTerms.includes('口径'));
  assert.ok(PRODUCT_LANGUAGE.prohibitedUiTerms.includes('可比记录'));
});