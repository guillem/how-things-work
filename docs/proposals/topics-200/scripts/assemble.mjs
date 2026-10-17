// Merges phase C's final rows (with fixes) back into the full pool entries and writes final.json.
// Usage: node assemble.mjs <phase-c output file>
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const DATA = path.resolve(here, '../data');
const pool = JSON.parse(fs.readFileSync(path.join(DATA, 'pool.json'), 'utf8'));
const byslug = Object.fromEntries(pool.map((e) => [e.slug, e]));
const KINDS = ['manipulate', 'simulate', 'step', 'build', 'explore'];
const norm = (s) =>
	String(s || '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

const text = fs.readFileSync(process.argv[2], 'utf8');
const start = text.indexOf('{');
const end = text.lastIndexOf('}');
const out = JSON.parse(text.slice(start, end + 1));
const result = out.result || out;
const gaps = Object.fromEntries((result.gapEntries || []).map((g) => [g.slug, g]));

const final = [];
const notes = [];
for (const row of result.final) {
	let e;
	if (row.origin === 'gap') {
		e = gaps[row.slug];
		if (!e) {
			notes.push(`gap entry ${row.slug} missing from gapEntries`);
			continue;
		}
		e = { ...e };
	} else {
		const base = byslug[row.slug];
		if (!base) {
			notes.push(`${row.slug} not in pool.json`);
			continue;
		}
		e = { ...base };
	}
	const fix = row.fix || {};
	for (const k of Object.keys(fix)) {
		const v = fix[k];
		if (v === undefined || v === null) continue;
		if (typeof v === 'string' && v.trim() === '' && !['needs', 'pitfall'].includes(k)) continue;
		if (k === 'slug') continue; // keep the slug the rows are keyed by
		e[k] = v;
	}
	e.level = Number(row.level);
	if (row.kind && KINDS.includes(row.kind)) e.kind = row.kind;
	if (row.title) e.title = row.title;
	e.prerequisites = (e.prerequisites || []).map(norm).filter(Boolean);
	e.related = (e.related || []).map(norm).filter(Boolean);
	e.leadsTo = (e.leadsTo || []).map(norm).filter(Boolean);
	e.needs = e.needs || '';
	e.pitfall = e.pitfall || '';
	e.score = row.score;
	e.scores = row.scores;
	e.judgeNotes = row.judgeNotes;
	e.verifyNote = row.verifyNote;
	e.originalLevel = row.originalLevel;
	e.fixedFields = Object.keys(fix);
	final.push(e);
}
fs.writeFileSync(path.join(DATA, 'final.json'), JSON.stringify(final, null, 1));
fs.writeFileSync(
	path.join(DATA, 'phase-c-summary.json'),
	JSON.stringify(
		{
			counts: result.counts,
			rejectedInVerify: result.rejectedInVerify,
			unverified: result.unverified,
			gapSwaps: result.gapSwaps,
			criticNotes: result.criticNotes,
			runnersUp: result.runnersUp,
			gapEntries: result.gapEntries
		},
		null,
		1
	)
);
console.log(
	`final.json: ${final.length} entries; fixed: ${final.filter((e) => e.fixedFields.length).length}; notes: ${notes.length}`
);
for (const n of notes) console.log('note', n);
