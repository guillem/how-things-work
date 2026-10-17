// Collects the finished generator lenses of a phase-A workflow run from its journal into the
// file prep-pool.mjs takes. Works for partial runs (a run killed by the usage limit).
// Usage: node collect-run.mjs <path to journal.jsonl> <output file, e.g. data/generators-run-3.json>
import fs from 'node:fs';

const [journal, out] = process.argv.slice(2);
const lines = fs
	.readFileSync(journal, 'utf8')
	.trim()
	.split('\n')
	.filter(Boolean)
	.map((l) => JSON.parse(l));
const label = {};
for (const l of lines) if (l.type === 'started' && l.agentId) label[l.agentId] = l.label;
const lenses = [];
for (const l of lines) {
	if (l.type !== 'result') continue;
	const name = l.label || label[l.agentId] || '';
	if (!name.startsWith('gen:')) continue;
	const r = l.result || {};
	lenses.push({
		lens: name.slice(4),
		ok: true,
		count: (r.candidates || []).length,
		candidates: r.candidates || [],
		reserveDisposition: r.reserveDisposition || []
	});
}
const failed = lines
	.filter((l) => l.type === 'failed')
	.map((l) => label[l.agentId] || l.label)
	.filter((n) => n && n.startsWith('gen:'))
	.map((n) => n.slice(4));
fs.writeFileSync(out, JSON.stringify(lenses, null, 1));
console.log(
	`${lenses.length} finished lenses -> ${out}: ${lenses.map((g) => `${g.lens} (${g.count})`).join(', ')}`
);
if (failed.length)
	console.log(`failed lenses (re-run with phase A): ${[...new Set(failed)].join(', ')}`);
