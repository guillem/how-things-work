// Builds the candidate pool from the recovered generator results and writes the files the
// phase-B and phase-C workflows point their agents at.
// Usage: node prep-pool.mjs <phase-a-output.json or .output file> [more ...]
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const DATA = path.resolve(here, '../data');
const CATS = JSON.parse(fs.readFileSync(path.join(DATA, 'existing.json'), 'utf8')).categories.map(
	(c) => c.id
);
const EX = new Set(
	JSON.parse(fs.readFileSync(path.join(DATA, 'existing.json'), 'utf8')).existing.map((e) => e.slug)
);
const KINDS = ['manipulate', 'simulate', 'step', 'build', 'explore'];
const norm = (s) =>
	String(s || '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

const done = JSON.parse(fs.readFileSync(path.join(DATA, 'generators-runs-1-2.json'), 'utf8'));
const pool = [];
const seen = new Set();
const dispositions = [...done.dispositions];
const add = (raw, origin) => {
	const e = { ...raw };
	e.slug = norm(e.slug);
	e.level = Math.max(0, Math.min(3, Math.round(Number(e.level))));
	if (!KINDS.includes(e.kind)) e.kind = 'manipulate';
	if (!CATS.includes(e.category)) return;
	e.prerequisites = (e.prerequisites || []).map(norm).filter(Boolean);
	e.related = (e.related || []).map(norm).filter(Boolean);
	e.leadsTo = (e.leadsTo || []).map(norm).filter(Boolean);
	e.needs = e.needs || '';
	e.pitfall = e.pitfall || '';
	e.origin = origin;
	if (!e.slug || EX.has(e.slug) || seen.has(e.slug)) return;
	seen.add(e.slug);
	pool.push(e);
};
for (const c of done.pool) add(c, c.origin);
for (const f of process.argv.slice(2)) {
	let text = fs.readFileSync(f, 'utf8');
	// a task .output file may wrap the JSON in other text; take the outermost array/object
	const start = Math.min(...['[', '{'].map((ch) => text.indexOf(ch)).filter((i) => i >= 0));
	const end = Math.max(text.lastIndexOf(']'), text.lastIndexOf('}'));
	const data = JSON.parse(text.slice(start, end + 1));
	const lenses = Array.isArray(data) ? data : data.result || [];
	for (const g of lenses) {
		if (!g || !g.ok) continue;
		for (const d of g.reserveDisposition || []) dispositions.push({ ...d, lens: g.lens });
		for (const c of g.candidates || []) add(c, g.lens);
	}
}
pool.sort(
	(a, b) =>
		CATS.indexOf(a.category) - CATS.indexOf(b.category) ||
		a.level - b.level ||
		a.slug.localeCompare(b.slug)
);

const dir = path.join(DATA, 'pool');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir);
const catFiles = {};
for (const c of CATS) {
	const items = pool.filter((e) => e.category === c);
	if (!items.length) continue;
	catFiles[c] = path.join(dir, `${c}.json`);
	fs.writeFileSync(catFiles[c], JSON.stringify(items, null, 1));
}
const BATCH = 25;
const rows = [];
for (let i = 0; i < pool.length; i += BATCH) {
	const batch = pool.slice(i, i + BATCH);
	const file = path.join(dir, `batch-${String(i / BATCH + 1).padStart(2, '0')}.json`);
	fs.writeFileSync(file, JSON.stringify(batch, null, 1));
	for (const e of batch) rows.push([e.slug, e.level, e.category, e.kind, e.title, i / BATCH + 1]);
}
fs.writeFileSync(path.join(DATA, 'pool.json'), JSON.stringify(pool, null, 1));
fs.writeFileSync(path.join(DATA, 'dispositions.json'), JSON.stringify(dispositions, null, 1));
fs.writeFileSync(
	path.join(DATA, 'phase-b-args.json'),
	JSON.stringify({ rows, poolDir: dir, batches: Math.ceil(pool.length / BATCH) })
);
const count = (k) => pool.reduce((a, e) => ((a[e[k]] = (a[e[k]] || 0) + 1), a), {});
console.log(
	`pool ${pool.length}; levels ${JSON.stringify(count('level'))}; categories ${JSON.stringify(count('category'))}; batches ${Math.ceil(pool.length / BATCH)}; dispositions ${dispositions.length}`
);
console.log(`phase-b-args.json: ${fs.statSync(path.join(DATA, 'phase-b-args.json')).size} bytes`);
