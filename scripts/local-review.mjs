// Fact-checks one explainer with a locally installed agent instead of the Batch API (whose credit
// can run out): the same review instructions as scripts/batch-review.ts, but the agent reads the
// files itself, read-only, with web search. Writes docs/reviews/<slug>.md; apply it by checking
// each fix against its source, then delete it (CLAUDE.md).
// Usage: node scripts/local-review.mjs <slug> [codex|claude|grok|pi:<provider/model>] (default codex)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [slug, agent = 'codex'] = process.argv.slice(2);
if (!slug || !fs.existsSync(path.join('src/routes', slug, 'steps.ts')))
	throw new Error(
		`usage: node scripts/local-review.mjs <slug> [agent]; no explainer for "${slug}"`
	);
const src = fs.readFileSync('scripts/batch-review.ts', 'utf8');
const m = src.match(/const INSTRUCTIONS = `([\s\S]*?)`;/);
if (!m) throw new Error('INSTRUCTIONS not found in scripts/batch-review.ts');
const instructions = m[1].replace(/\\`/g, '`');

const tests = fs
	.readdirSync('e2e')
	.filter(
		(n) => n.endsWith('.e2e.ts') && fs.readFileSync(path.join('e2e', n), 'utf8').includes(`${slug}`)
	)
	.map((n) => `e2e/${n}`);
const prompt = `${instructions}

How this review differs from the batch version: nothing is pasted below; read the files yourself (read-only; do not modify anything). The catalogue is docs/TOPICS.md: read its preamble and the entry "#### ${slug}" (and the entries of its prerequisites). The topic's source is every file under src/routes/${slug}/ (steps.ts, the model, the stage and scenes/*.svelte). Its tests: ${tests.join(', ') || 'none found'}. Shared drawing helpers are in src/lib/draw/ and the framework in src/lib/explainer/ (not under review). Data sources and licences: docs/DATA-SOURCES.md. Use web search to verify facts. Output only the Markdown report, starting with "# Review: ${slug}".`;

const out = path.join('docs/reviews', `${slug}.md`);
fs.mkdirSync('docs/reviews', { recursive: true });
// The agent's progress goes to a log file, not the terminal (it is long).
const log = path.join(os.tmpdir(), `local-review-${slug}.log`);
const fd = fs.openSync(log, 'w');
const opts = { stdio: ['ignore', fd, fd], maxBuffer: 1 << 26 };
if (agent === 'codex') {
	execFileSync(
		'codex',
		['exec', '-s', 'read-only', '--ephemeral', '-c', 'web_search=live', '-o', out, prompt],
		opts
	);
} else if (agent === 'claude') {
	// Explicitly limit the reviewer to reading files and consulting sources. In particular,
	// it cannot edit the explainer or run the project's build/release hooks.
	const readTools = 'Read,Glob,Grep,WebSearch,WebFetch';
	const text = execFileSync(
		'claude',
		[
			'-p',
			'--restricted',
			'--strict-mcp-config',
			'--no-session-persistence',
			'--tools',
			readTools,
			'--allowedTools',
			readTools,
			'--output-format',
			'text',
			prompt
		],
		{ ...opts, stdio: ['ignore', 'pipe', fd], encoding: 'utf8' }
	);
	fs.writeFileSync(out, text);
} else if (agent === 'grok') {
	const text = execFileSync('grok', ['-p', prompt, '-m', 'grok-4.7', '--effort', 'medium'], {
		...opts,
		stdio: ['ignore', 'pipe', fd],
		encoding: 'utf8'
	});
	fs.writeFileSync(out, text);
} else if (agent.startsWith('pi:')) {
	const text = execFileSync(
		'pi',
		['-p', '--no-session', '--model', agent.slice(3), '--tools', 'read,grep,find,ls', prompt],
		{
			...opts,
			stdio: ['ignore', 'pipe', fd],
			encoding: 'utf8'
		}
	);
	fs.writeFileSync(out, text);
} else throw new Error(`unknown agent ${agent}`);
const report = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
if (!report.includes(`# Review: ${slug}`))
	throw new Error(`${out}: no report written (agent ${agent})`);
console.log(`${out}: ${report.split('\n').length} lines (agent ${agent}; its log: ${log})`);
