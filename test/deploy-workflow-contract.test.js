import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const wrangler = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8');

test('deploy workflow is triggered only by main CI completions', () => {
  assert.match(workflow, /workflows: \[CI\]/);
  assert.match(workflow, /types: \[completed\]/);
  assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/);
  assert.match(workflow, /actions\/setup-node@a0853c24544627f65ddf259abe73b1d18a591444/);
  assert.doesNotMatch(workflow, /workflow_run\.head_branch/);
});

test('release version is aligned', () => {
  assert.equal(pkg.version, '0.12.27');
  assert.match(wrangler, /APP_VERSION = "0\.12\.27"/);
});

test('deployment still checks exact tested SHA', () => {
  assert.match(workflow, /TESTED_SHA:\s*\$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(workflow, /CHECKED_OUT_SHA.*TESTED_SHA/);
  assert.match(workflow, /payload\.buildSha === sha/);
});
