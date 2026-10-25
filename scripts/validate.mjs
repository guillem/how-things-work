// One entry point for manual checks and hooks. Only successful stages are cached.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createPlan } from './validation-plan.mjs';

const root = process.cwd();
const args = process.argv.slice(2);
const mode = args.shift() ?? 'check';
if (!['check', 'changed', 'quick'].includes(mode))
	throw new Error(`Unknown validation mode: ${mode}`);
let base;
const topics = [];
let print = false;
let fresh = process.env.CI === 'true' || process.env.CI === '1';
while (args.length) {
	const arg = args.shift();
	if (arg === '--base' || arg === '--topic') {
		const value = args.shift();
		if (!value || value.startsWith('-')) throw new Error(`${arg} requires a value`);
		if (arg === '--base') base = value;
		else topics.push(value);
	} else if (arg === '--plan') print = true;
	else if (arg === '--fresh') fresh = true;
	else throw new Error(`Unknown argument: ${arg}`);
}
function capture(command, argv) {
	const result = spawnSync(command, argv, { cwd: root, encoding: 'utf8' });
	if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stderr);
	return result.stdout;
}
if (fs.lstatSync('node_modules').isSymbolicLink())
	throw new Error(
		'Clone node_modules into this checkout; a symlink makes type checks use another checkout.'
	);
const files = [
	...new Set(
		capture('git', ['ls-files', '-c', '-o', '--exclude-standard', '-z']).split('\0').filter(Boolean)
	)
].sort();
const changed = [
	...new Set(
		[
			...capture('git', ['diff', '--name-only', '-z', base ?? 'HEAD', '--']).split('\0'),
			...capture('git', ['ls-files', '--others', '--exclude-standard', '-z']).split('\0')
		].filter(Boolean)
	)
].sort();
const plan = createPlan(root, changed, topics);
if (print) {
	console.log(
		JSON.stringify(
			{
				mode,
				base: base ?? 'HEAD (including staged, unstaged and untracked files)',
				changed,
				...plan
			},
			null,
			2
		)
	);
	process.exit(0);
}
const cache = path.join(root, '.cache/validation');
fs.mkdirSync(cache, { recursive: true });
const bin = (name) => path.join(root, 'node_modules/.bin', name);
function run(command, argv, env = {}) {
	console.log(`> ${path.basename(command)} ${argv.join(' ')}`);
	const result = spawnSync(command, argv, {
		cwd: root,
		stdio: 'inherit',
		env: { ...process.env, ...env }
	});
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
}
function stage(name, inputs, commands) {
	const hash = crypto
		.createHash('sha256')
		.update(JSON.stringify([process.version, process.platform, process.arch, commands]));
	// Tooling changes invalidate every stage. Documentation only invalidates formatting.
	const config =
		/(?:^|\/)(?:package(?:-lock)?\.json|[^/]*config[^/]*|Makefile|\.npmrc|\.nvmrc)$|^scripts\/(?:validate|validation-plan)\.mjs$|^\.(?:gitignore|prettierignore)$/;
	for (const file of files.filter((file) => inputs(file) || config.test(file))) {
		hash.update(file);
		const absolute = path.join(root, file);
		if (fs.existsSync(absolute) && fs.statSync(absolute).isFile())
			hash.update(fs.readFileSync(absolute));
		else hash.update('missing');
	}
	const key = hash.digest('hex');
	const stamp = path.join(cache, `${name}.json`);
	if (!fresh && fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === key) {
		console.log(`${name}: unchanged since last successful check, skipped.`);
		return;
	}
	for (const [command, argv] of commands) run(command, argv);
	// A concurrent edit must not certify files that were not checked.
	fs.writeFileSync(stamp, key);
}
const source = (file) =>
	/^(?:src|e2e)\//.test(file) ||
	['scripts/batch-review.ts', 'docs/TOPICS.md', 'docs/PATHS.md'].includes(file);
const types = () =>
	stage('types', source, [
		[bin('svelte-kit'), ['sync']],
		[
			bin('svelte-check'),
			['--tsconfig', './tsconfig.json', '--fail-on-warnings', '--output', 'machine']
		]
	]);
if (mode === 'check' || plan.broad) {
	stage('format', () => true, [[bin('prettier'), ['--check', '.', '--log-level', 'warn']]]);
	stage('lint', (file) => /\.(?:[cm]?[jt]s|svelte)$/.test(file), [
		[
			bin('eslint'),
			[
				'.',
				'--cache',
				'--cache-strategy',
				'content',
				'--cache-location',
				'.cache/validation/eslint'
			]
		]
	]);
	types();
	stage('workflow', (file) => file.startsWith('scripts/validation-'), [
		[process.execPath, ['--test', 'scripts/validation-plan.test.mjs']]
	]);
	stage('models', source, [[bin('playwright'), ['test', '-c', 'playwright.models.config.ts']]]);
} else {
	if (plan.format.length)
		stage('format-changed', (file) => plan.format.includes(file), [
			[
				bin('prettier'),
				['--check', '--ignore-unknown', '--log-level', 'warn', '--', ...plan.format]
			]
		]);
	if (plan.lint.length)
		stage('lint-changed', (file) => /\.(?:[cm]?[jt]s|svelte)$/.test(file), [
			[
				bin('eslint'),
				[
					'--cache',
					'--cache-strategy',
					'content',
					'--cache-location',
					'.cache/validation/eslint',
					'--',
					...plan.lint
				]
			]
		]);
	if (plan.types) types();
	if (plan.models.length)
		stage('models-changed', source, [
			[bin('playwright'), ['test', '-c', 'playwright.models.config.ts', ...plan.models]]
		]);
}
if (mode === 'changed') {
	if (plan.broad) run(bin('playwright'), ['test']);
	else {
		if (plan.browser.length)
			run(bin('playwright'), ['test', '-c', 'playwright.dev.config.ts', ...plan.browser]);
		if (plan.scenes)
			run(bin('playwright'), ['test', '-c', 'playwright.dev.config.ts', 'e2e/scenes.e2e.ts'], {
				PW_TOPICS: plan.topics.join(',')
			});
	}
}
if (!changed.length && !topics.length && mode !== 'check')
	console.log('No changes to validate. Use --base <ref> for committed changes.');
