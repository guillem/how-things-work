// Checks that the live site serves the current `main`: waits for the Pages
// deployment of the latest commit on origin/main, then requests the home page
// and every built topic and reports any that don't answer 200.
//
// Usage: npm run verify:deploy        (needs the GitHub CLI, `gh`, logged in)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const SITE = 'https://guillem.github.io/how-things-work';
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim();

sh('git', ['fetch', '-q', 'origin', 'main']);
const sha = sh('git', ['rev-parse', 'origin/main']);
const runs = JSON.parse(
	sh('gh', [
		'run',
		'list',
		'--workflow',
		'Deploy to GitHub Pages',
		'--commit',
		sha,
		'--json',
		'databaseId',
		'--limit',
		'1'
	])
);
if (!runs.length) {
	console.error(`No Pages deployment found for ${sha.slice(0, 7)} yet; try again in a minute.`);
	process.exit(1);
}
console.log(`Waiting for the deployment of ${sha.slice(0, 7)}…`);
try {
	execFileSync(
		'gh',
		['run', 'watch', String(runs[0].databaseId), '--exit-status', '--interval', '10'],
		{
			stdio: ['ignore', 'ignore', 'inherit']
		}
	);
} catch {
	console.error('The deployment failed: see `gh run view --log-failed`.');
	process.exit(1);
}

const slugs = [
	...fs.readFileSync('src/lib/topics.ts', 'utf8').matchAll(/slug: '([a-z0-9-]+)'/g)
].map((m) => m[1]);
let bad = 0;
for (const path of ['', ...slugs.map((s) => `${s}/`)]) {
	const res = await fetch(`${SITE}/${path}`, { cache: 'no-store' });
	const ok = res.ok;
	if (!ok) bad++;
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${res.status} /${path}`);
}
console.log(bad ? `${bad} page(s) failed.` : `Live site OK: home page and ${slugs.length} topics.`);
process.exit(bad ? 1 : 0);
