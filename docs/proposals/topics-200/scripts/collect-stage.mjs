// Collects the finished agents of a staged workflow run (phases B and C) from its journal.
// Works for partial runs (a run killed by the usage limit): it lists the labels that started
// and never returned, so the next run can ask for exactly those.
// Usage: node collect-stage.mjs <journal.jsonl> <label prefix, e.g. judge:> <output file>
import fs from 'node:fs';

const [journal, prefix, out] = process.argv.slice(2);
const lines = fs
	.readFileSync(journal, 'utf8')
	.trim()
	.split('\n')
	.filter(Boolean)
	.map((l) => JSON.parse(l));
const label = {};
for (const l of lines) if (l.type === 'started' && l.agentId) label[l.agentId] = l.label;
const results = [];
const done = new Set();
for (const l of lines) {
	if (l.type !== 'result') continue;
	const name = l.label || label[l.agentId] || '';
	if (!name.startsWith(prefix) || !l.result) continue;
	results.push({ label: name, result: l.result });
	done.add(name);
}
const missing = [
	...new Set(Object.values(label).filter((n) => n && n.startsWith(prefix) && !done.has(n)))
];
fs.writeFileSync(out, JSON.stringify(results, null, 1));
console.log(`${results.length} results -> ${out}`);
if (missing.length) console.log(`started without a result: ${missing.join(', ')}`);
