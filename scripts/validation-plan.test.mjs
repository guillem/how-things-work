import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createPlan } from './validation-plan.mjs';

function fixture(t) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'validation-plan-'));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const files = {
		'src/routes/electric-circuits/steps.ts': '',
		'src/routes/electric-circuits/circuit.ts': '',
		'src/routes/other/steps.ts': '',
		'src/routes/other/model.ts': "import { x } from '../electric-circuits/circuit';",
		'src/routes/unrelated/steps.ts': '',
		'e2e/circuit-model.e2e.ts': "import { x } from '../src/routes/electric-circuits/circuit';",
		'e2e/other-model.e2e.ts': "import { x } from '../src/routes/other/model';",
		'e2e/unrelated-model.e2e.ts': '',
		'e2e/electric-circuits.e2e.ts': "page.goto('./electric-circuits/#start');",
		'e2e/other.e2e.ts': "page.goto('./other/');",
		'e2e/phone-readouts.e2e.ts': "page.goto('./electric-circuits/#start');",
		'e2e/scenes.e2e.ts': '',
		'docs/STATUS.md': '',
		'docs/TOPICS.md': '',
		'docs/PATHS.md': ''
	};
	for (const [file, text] of Object.entries(files)) {
		fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
		fs.writeFileSync(path.join(root, file), text);
	}
	return root;
}

test('renamed model tests, transitive consumers and mixed-topic browser tests are selected', (t) => {
	const plan = createPlan(fixture(t), ['src/routes/electric-circuits/circuit.ts']);
	assert.equal(plan.broad, false);
	assert.deepEqual(plan.topics, ['electric-circuits', 'other']);
	assert.deepEqual(plan.models, ['e2e/circuit-model.e2e.ts', 'e2e/other-model.e2e.ts']);
	assert.deepEqual(plan.browser, [
		'e2e/electric-circuits.e2e.ts',
		'e2e/other.e2e.ts',
		'e2e/phone-readouts.e2e.ts'
	]);
	assert.equal(plan.scenes, true);
});

test('status edits only need formatting', (t) => {
	const plan = createPlan(fixture(t), ['docs/STATUS.md']);
	assert.equal(plan.broad, false);
	assert.equal(plan.types, false);
	assert.deepEqual(plan.models, []);
	assert.deepEqual(plan.browser, []);
	assert.equal(plan.scenes, false);
});

test('catalogue, paths, shared code, deleted tests and unknown tooling fall back to full checks', (t) => {
	const root = fixture(t);
	for (const file of [
		'docs/TOPICS.md',
		'docs/PATHS.md',
		'src/lib/draw/Label.svelte',
		'e2e/deleted.e2e.ts',
		'package-lock.json',
		'scripts/new.mjs'
	]) {
		const plan = createPlan(root, [file]);
		assert.equal(plan.broad, true, file);
		assert.equal(plan.models.length, 3, file);
	}
});

test('changed test files run even without a topic', (t) => {
	const plan = createPlan(fixture(t), ['e2e/unrelated-model.e2e.ts']);
	assert.equal(plan.broad, false);
	assert.deepEqual(plan.models, ['e2e/unrelated-model.e2e.ts']);
});

test('explicit topics work after committing; invalid topics fail instead of silently skipping', (t) => {
	const root = fixture(t);
	assert.equal(createPlan(root, [], ['electric-circuits']).scenes, true);
	assert.throws(() => createPlan(root, [], ['typo']), /Unknown topic/);
});

test('deleting a topic remains a broad change', (t) => {
	assert.equal(createPlan(fixture(t), ['src/routes/deleted/steps.ts']).broad, true);
});

test('no edits means no targeted test work', (t) => {
	const plan = createPlan(fixture(t), []);
	assert.deepEqual(plan.models, []);
	assert.deepEqual(plan.browser, []);
	assert.equal(plan.scenes, false);
});

// Exercise the actual CLI/cache against tiny tools, so these checks stay fast.
async function cacheFixture(t) {
	const { spawnSync } = await import('node:child_process');
	const root = fixture(t);
	const cli = new URL('./validate.mjs', import.meta.url);
	fs.writeFileSync(path.join(root, '.gitignore'), 'node_modules\n.cache\ncommands.log\n');
	fs.writeFileSync(path.join(root, 'package-lock.json'), '{}');
	fs.mkdirSync(path.join(root, 'scripts'));
	fs.writeFileSync(path.join(root, 'scripts/validation-plan.test.mjs'), '// fixture\n');
	fs.mkdirSync(path.join(root, 'node_modules/.bin'), { recursive: true });
	for (const tool of ['prettier', 'eslint', 'svelte-kit', 'svelte-check', 'playwright']) {
		fs.writeFileSync(
			path.join(root, 'node_modules/.bin', tool),
			`#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync('commands.log', '${tool}\\n');
if (process.env.FAIL_TOOL === '${tool}') process.exit(1);
`,
			{ mode: 0o755 }
		);
	}
	assert.equal(spawnSync('git', ['init', '-q'], { cwd: root }).status, 0);
	const emptyTree = spawnSync('git', ['hash-object', '-t', 'tree', '/dev/null'], {
		cwd: root,
		encoding: 'utf8'
	}).stdout.trim();
	return {
		write(file, text) {
			fs.writeFileSync(path.join(root, file), text);
		},
		check(env = {}) {
			fs.writeFileSync(path.join(root, 'commands.log'), '');
			const result = spawnSync(process.execPath, [cli.pathname, 'check', '--base', emptyTree], {
				cwd: root,
				encoding: 'utf8',
				env: { ...process.env, CI: '', ...env }
			});
			return {
				...result,
				tools: fs
					.readFileSync(path.join(root, 'commands.log'), 'utf8')
					.trim()
					.split('\n')
					.filter(Boolean)
			};
		}
	};
}

test('successful checks are reused; documentation only reruns formatting; dependencies invalidate all', async (t) => {
	const fixture = await cacheFixture(t);
	const first = fixture.check();
	assert.equal(first.status, 0, first.stderr);
	assert.deepEqual(first.tools, ['prettier', 'eslint', 'svelte-kit', 'svelte-check', 'playwright']);
	assert.deepEqual(fixture.check().tools, []);
	fixture.write('docs/STATUS.md', 'A milestone\n');
	assert.deepEqual(fixture.check().tools, ['prettier']);
	fixture.write('package-lock.json', '{"changed":true}');
	assert.deepEqual(fixture.check().tools, first.tools);
});

test('a failing stage is retried and never marked as passing', async (t) => {
	const fixture = await cacheFixture(t);
	assert.equal(fixture.check({ FAIL_TOOL: 'svelte-check' }).status, 1);
	const retry = fixture.check();
	assert.equal(retry.status, 0, retry.stderr);
	assert.deepEqual(retry.tools, ['svelte-kit', 'svelte-check', 'playwright']);
});

test('CI bypasses local successful-stage stamps', async (t) => {
	const fixture = await cacheFixture(t);
	const first = fixture.check();
	const ci = fixture.check({ CI: 'true' });
	assert.equal(ci.status, 0, ci.stderr);
	assert.deepEqual(ci.tools, first.tools);
});
