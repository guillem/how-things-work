// Appends the candidates of a later generator run (collect-run.mjs output) to the existing pool
// without renumbering it: pool.json, pool/<category>.json, a new pool/batch-NN.json and the rows
// in phase-b-args.json. prep-pool.mjs would rebuild and renumber everything, which would orphan
// the batch numbers of the judge runs already collected.
// Usage: node add-candidates.mjs <data/generators-run-N.json>
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const DATA = path.resolve(here, '../data');
const existing = JSON.parse(fs.readFileSync(path.join(DATA, 'existing.json'), 'utf8'));
const CATS = existing.categories.map((c) => c.id);
const EX = new Set(existing.existing.map((e) => e.slug));
const KINDS = ['manipulate', 'simulate', 'step', 'build', 'explore'];
const norm = (s) =>
	String(s || '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
const pool = JSON.parse(fs.readFileSync(path.join(DATA, 'pool.json'), 'utf8'));
const args = JSON.parse(fs.readFileSync(path.join(DATA, 'phase-b-args.json'), 'utf8'));
const seen = new Set(pool.map((e) => e.slug));
const added = [];
const skipped = [];
for (const g of JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))) {
	for (const raw of g.candidates || []) {
		const e = { ...raw };
		e.slug = norm(e.slug);
		e.level = Math.max(0, Math.min(3, Math.round(Number(e.level))));
		if (!KINDS.includes(e.kind)) e.kind = 'manipulate';
		e.prerequisites = (e.prerequisites || []).map(norm).filter(Boolean);
		e.related = (e.related || []).map(norm).filter(Boolean);
		e.leadsTo = (e.leadsTo || []).map(norm).filter(Boolean);
		e.needs = e.needs || '';
		e.pitfall = e.pitfall || '';
		e.origin = g.lens;
		if (!CATS.includes(e.category) || !e.slug || EX.has(e.slug) || seen.has(e.slug)) {
			skipped.push(e.slug);
			continue;
		}
		seen.add(e.slug);
		added.push(e);
	}
}
const batchNo = args.batches + 1;
const dir = path.join(DATA, 'pool');
fs.writeFileSync(
	path.join(dir, `batch-${String(batchNo).padStart(2, '0')}.json`),
	JSON.stringify(added, null, 1)
);
for (const c of [...new Set(added.map((e) => e.category))]) {
	const f = path.join(dir, `${c}.json`);
	const items = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
	fs.writeFileSync(
		f,
		JSON.stringify([...items, ...added.filter((e) => e.category === c)], null, 1)
	);
}
fs.writeFileSync(path.join(DATA, 'pool.json'), JSON.stringify([...pool, ...added], null, 1));
args.rows.push(...added.map((e) => [e.slug, e.level, e.category, e.kind, e.title, batchNo]));
args.batches = batchNo;
fs.writeFileSync(path.join(DATA, 'phase-b-args.json'), JSON.stringify(args));
console.log(
	`added ${added.length} as batch ${batchNo}: ${added.map((e) => `${e.slug} (L${e.level}, ${e.category})`).join(', ')}`
);
if (skipped.length) console.log(`skipped ${skipped.join(', ')}`);
