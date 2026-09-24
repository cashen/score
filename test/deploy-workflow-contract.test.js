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
  assert.match(workflow, /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/);
  assert.match(workflow, /actions\/setup-node@820762786026740c76f36085b0efc47a31fe5020/);
  assert.doesNotMatch(workflow, /workflow_run\.head_branch/);
});

test('release version is aligned', () => {
  assert.match(pkg.version, /^0\.12\.\d+(?:\.\d+)?$/);
  const versionPattern = new RegExp('^APP_VERSION = "' + pkg.version.replaceAll('.', '\\.') + '"$', 'm');
  assert.match(wrangler, versionPattern);
});

test('deployment still checks exact tested SHA', () => {
  assert.match(workflow, /TESTED_SHA:\s*\$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(workflow, /CHECKED_OUT_SHA.*TESTED_SHA/);
  assert.match(workflow, /payload\.buildSha === sha/);
  assert.match(workflow, /--secrets-file \.runtime-secrets\.json/);
  assert.match(workflow, /--var BUILD_SHA:\$\{TESTED_SHA\}/);
  assert.doesNotMatch(workflow, /--keep-vars/);
  assert.doesNotMatch(workflow, /--var APP_VERSION:/);
});
