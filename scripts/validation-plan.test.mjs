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

test('catalogue, paths, shared code, deleted files and tooling the site uses fall back to full checks', (t) => {
	const root = fixture(t);
	fs.writeFileSync(path.join(root, 'playwright.config.ts'), "'node scripts/serve-pages.mjs'");
	fs.mkdirSync(path.join(root, 'scripts'));
	fs.writeFileSync(path.join(root, 'scripts/serve-pages.mjs'), '');
	for (const file of [
		'docs/TOPICS.md',
		'docs/PATHS.md',
		'src/lib/draw/Label.svelte',
		'e2e/deleted.e2e.ts',
		'package-lock.json',
		'scripts/deleted.mjs',
		'scripts/serve-pages.mjs'
	]) {
		const plan = createPlan(root, [file]);
		assert.equal(plan.broad, true, file);
		assert.equal(plan.models.length, 3, file);
	}
});

test('tooling outside the site reruns only formatting, lint and the tests that import it', (t) => {
	const root = fixture(t);
	for (const [file, text] of Object.entries({
		'scripts/shot.mjs': '',
		'scripts/validation-plan.mjs': '',
		'.github/workflows/release.yml': '',
		'e2e/play.ts': '',
		'e2e/other.e2e.ts': "import { play } from './play'; page.goto('./other/');"
	})) {
		fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
		fs.writeFileSync(path.join(root, file), text);
	}
	const tooling = createPlan(root, ['.github/workflows/release.yml', 'scripts/shot.mjs']);
	assert.equal(tooling.broad, false);
	assert.deepEqual(tooling.format, ['.github/workflows/release.yml', 'scripts/shot.mjs']);
	assert.deepEqual(tooling.lint, ['scripts/shot.mjs']);
	assert.equal(tooling.types, false);
	assert.equal(tooling.workflow, false);
	assert.deepEqual([...tooling.models, ...tooling.browser], []);
	assert.equal(tooling.scenes, false);

	const helper = createPlan(root, ['e2e/play.ts']);
	assert.equal(helper.broad, false);
	assert.deepEqual(helper.browser, ['e2e/other.e2e.ts']);
	assert.equal(helper.types, true);
	assert.equal(helper.scenes, false);

	const validation = createPlan(root, ['scripts/validation-plan.mjs']);
	assert.equal(validation.broad, false);
	assert.equal(validation.workflow, true);
	assert.deepEqual(validation.browser, []);
});

test('changed test files run even without a topic', (t) => {
	const plan = createPlan(fixture(t), ['e2e/unrelated-model.e2e.ts']);
	assert.equal(plan.broad, false);
	assert.deepEqual(plan.models, ['e2e/unrelated-model.e2e.ts']);
});

test('explicit topics work after committing; invalid topics fail instead of silently skipping', (t) => {
	const root = fixture(t);
	const plan = createPlan(root, [], ['electric-circuits']);
	assert.equal(plan.scenes, true);
	for (const file of [
		'src/routes/electric-circuits/circuit.ts',
		'src/routes/other/model.ts',
		'e2e/circuit-model.e2e.ts',
		'e2e/electric-circuits.e2e.ts'
	]) {
		assert.ok(plan.format.includes(file), `format ${file}`);
		assert.ok(plan.lint.includes(file), `lint ${file}`);
	}
	assert.ok(!plan.lint.includes('src/routes/unrelated/steps.ts'));
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
// Targeted browser runs also record their files and topic narrowing.
const targeted = process.env.PW_FULL_FILES === undefined ? '' :
	\` \${process.argv.slice(2).join(' ')} | topics=\${process.env.PW_TOPICS} | full=\${process.env.PW_FULL_FILES}\`;
fs.appendFileSync('commands.log', '${tool}' + targeted + '\\n');
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
		root,
		write(file, text) {
			fs.writeFileSync(path.join(root, file), text);
		},
		git(...args) {
			const result = spawnSync(
				'git',
				[
					...['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid'],
					...['-c', 'commit.gpgsign=false', ...args]
				],
				{ cwd: root, encoding: 'utf8' }
			);
			assert.equal(result.status, 0, result.stderr);
		},
		check(
			env = {},
			args = ['check', '--base', emptyTree],
			command = [process.execPath, cli.pathname]
		) {
			fs.writeFileSync(path.join(root, 'commands.log'), '');
			const result = spawnSync(command[0], [...command.slice(1), ...args], {
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

// Use real type-aware lint here: mocked tools cannot expose stale per-file caches.
test('dependency type changes fail lint in unchanged consumers, including fresh and targeted checks', async (t) => {
	const { spawnSync } = await import('node:child_process');
	const f = await cacheFixture(t);
	f.write(
		'tsconfig.json',
		JSON.stringify({ compilerOptions: { strict: true }, include: ['src', 'e2e'] })
	);
	f.write(
		'eslint.config.mjs',
		`import ts from ${JSON.stringify(import.meta.resolve('typescript-eslint'))};
export default [{files: ['src/**/*.ts', 'e2e/**/*.ts'],
languageOptions: {parser: ts.parser, parserOptions: {project: './tsconfig.json', tsconfigRootDir: import.meta.dirname}},
plugins: {'@typescript-eslint': ts.plugin}, rules: {'@typescript-eslint/no-unsafe-return': 'error'}}];`
	);
	const dependency = 'src/routes/electric-circuits/circuit.ts';
	f.write(dependency, 'export function value(): number { return 1; }');
	f.write(
		'e2e/circuit-model.e2e.ts',
		"import { value } from '../src/routes/electric-circuits/circuit'; export function result(): number { return value(); }"
	);
	const eslint = new URL('../node_modules/eslint/bin/eslint.js', import.meta.url).pathname;
	f.write(
		'node_modules/.bin/eslint',
		`#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const r = spawnSync(process.execPath, [${JSON.stringify(eslint)}, ...process.argv.slice(2)], {stdio: 'inherit'});
process.exit(r.status ?? 1);
`
	);
	const first = f.check();
	assert.equal(first.status, 0, first.stdout + first.stderr);
	for (const args of [
		['add', '.'],
		['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture']
	]) {
		assert.equal(spawnSync('git', args, { cwd: f.root }).status, 0);
	}
	f.write(dependency, 'export function value(): any { return 1; }');
	for (const args of [['quick'], ['check'], ['check', '--fresh']]) {
		const result = f.check({}, args);
		assert.equal(result.status, 1, `${args}: ${result.stdout}${result.stderr}`);
		assert.match(result.stdout, /no-unsafe-return/);
		assert.match(result.stdout, /circuit-model.e2e.ts/);
	}
});

test('targeted browser runs share one build and narrow many-topic files, except changed ones', async (t) => {
	const fixture = await cacheFixture(t);
	fixture.git('add', '.');
	fixture.git('commit', '-qm', 'fixture');
	fixture.write('src/routes/electric-circuits/circuit.ts', '// edited\n');
	fixture.write('e2e/phone-readouts.e2e.ts', "page.goto('./other/');");
	const result = fixture.check({}, ['changed']);
	assert.equal(result.status, 0, result.stdout + result.stderr);
	assert.deepEqual(
		result.tools.filter((line) => line.includes('|')),
		[
			'playwright test -c playwright.changed.config.ts e2e/electric-circuits.e2e.ts e2e/other.e2e.ts ' +
				'e2e/phone-readouts.e2e.ts e2e/scenes.e2e.ts | topics=electric-circuits,other | ' +
				'full=e2e/phone-readouts.e2e.ts'
		]
	);
});

test('hooks check commits that are not pushed yet, and nothing once they are', async (t) => {
	const fixture = await cacheFixture(t);
	for (const file of ['check-if-changed.sh', 'validate.mjs', 'validation-plan.mjs'])
		fs.copyFileSync(new URL(file, import.meta.url), path.join(fixture.root, 'scripts', file));
	const origin = fs.mkdtempSync(path.join(os.tmpdir(), 'validation-origin-'));
	t.after(() => fs.rmSync(origin, { recursive: true, force: true }));
	fixture.git('init', '-q', '--bare', origin);
	fixture.git('remote', 'add', 'origin', origin);
	fixture.git('add', '.');
	fixture.git('commit', '-qm', 'fixture');
	fixture.git('push', '-qu', 'origin', 'HEAD');
	fixture.write('src/routes/electric-circuits/circuit.ts', '// edited\n');
	fixture.git('commit', '-qam', 'edit');
	const hook = () => fixture.check({}, [], ['bash', 'scripts/check-if-changed.sh']);
	const unpushed = hook();
	assert.equal(unpushed.status, 0, unpushed.stdout + unpushed.stderr);
	assert.deepEqual(unpushed.tools, [
		'prettier',
		'eslint',
		'svelte-kit',
		'svelte-check',
		'playwright'
	]);
	fixture.git('push', '-q');
	const pushed = hook();
	assert.equal(pushed.status, 0, pushed.stdout + pushed.stderr);
	assert.deepEqual(pushed.tools, []);
});
