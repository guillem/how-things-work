// Merges phase C's final rows (with fixes) back into the full pool entries and writes final.json.
// Then a mechanical link pass: prerequisites and related links that point at neither an existing
// topic nor a proposed one are dropped (logged in linkLog), related links among proposed topics
// are made mutual, and leadsTo keeps only existing topics. Semantic problems (a prerequisite
// above the topic's level) are left for render.mjs to report and for a hand fix in final.json.
// Usage: node assemble.mjs [data/verified.json, written by replace.mjs]
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

const text = fs.readFileSync(process.argv[2] || path.join(DATA, 'verified.json'), 'utf8');
const start = text.indexOf('{');
const end = text.lastIndexOf('}');
const out = JSON.parse(text.slice(start, end + 1));
const result = out.result || out;
const gaps = Object.fromEntries(
	(result.gapEntries || []).filter((g) => g.kept === 'selected').map((g) => [g.slug, g])
);

const final = [];
const notes = [];
for (const row of result.final) {
	let e;
	if (String(row.origin || '').startsWith('gap')) {
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
	if (row.category) e.category = row.category; // select.mjs may re-file a topic
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
	e.origin = row.origin || e.origin;
	if (row.replaces) e.replaces = row.replaces;
	e.originalLevel = row.originalLevel;
	e.fixedFields = Object.keys(fix);
	final.push(e);
}
// Agents' structured output sometimes carries HTML entities (&amp;); the catalogue is plain text.
const decode = (v) =>
	typeof v === 'string'
		? v
				.replace(/&amp;/g, '&')
				.replace(/&lt;/g, '<')
				.replace(/&gt;/g, '>')
				.replace(/&quot;/g, '"')
				.replace(/&#39;/g, "'")
		: Array.isArray(v)
			? v.map(decode)
			: v;
for (const e of final) for (const k of Object.keys(e)) e[k] = decode(e[k]);

// --- editorial fixes by hand (data/editorial.json: { slug: { field: value } }), kept in a file so
// that a re-run of the stages and of this script does not lose them ---
const EDITS_FILE = path.join(DATA, 'editorial.json');
const edits = fs.existsSync(EDITS_FILE) ? JSON.parse(fs.readFileSync(EDITS_FILE, 'utf8')) : {};
for (const e of final)
	for (const [k, v] of Object.entries(edits[e.slug] || {})) {
		e[k] = v;
		e.editorial = [...(e.editorial || []), k];
	}
for (const s of Object.keys(edits))
	if (!final.some((e) => e.slug === s))
		notes.push(`editorial.json names ${s}, which is not in the final list`);

// --- mechanical link pass ---
const existing = new Set(
	JSON.parse(fs.readFileSync(path.join(DATA, 'existing.json'), 'utf8')).existing.map((x) => x.slug)
);
const F = Object.fromEntries(final.map((e) => [e.slug, e]));
const known = (s) => existing.has(s) || !!F[s];
for (const e of final) {
	e.linkLog = [];
	const prereq = [...new Set(e.prerequisites)].filter((p) => p !== e.slug);
	e.prerequisites = prereq.filter(known);
	for (const p of prereq.filter((p) => !known(p)))
		e.linkLog.push(`dropped prerequisite ${p} (not selected)`);
	const rel = [...new Set(e.related)].filter((r) => r !== e.slug);
	e.related = rel.filter((r) => known(r) && !e.prerequisites.includes(r));
	for (const r of rel.filter((r) => !known(r)))
		e.linkLog.push(`dropped related ${r} (not selected)`);
	const lt = e.leadsTo;
	e.leadsTo = lt.filter((l) => existing.has(l));
	for (const l of lt.filter((l) => !existing.has(l)))
		e.linkLog.push(`dropped leadsTo ${l} (not an existing topic)`);
}
for (const e of final) {
	for (const r of [...e.related]) {
		const o = F[r];
		if (!o) continue;
		if (o.prerequisites.includes(e.slug)) {
			e.related = e.related.filter((x) => x !== r);
			e.linkLog.push(`dropped related ${r} (it lists this topic as a prerequisite)`);
		} else if (!o.related.includes(e.slug)) {
			o.related.push(e.slug);
			o.linkLog.push(`added related ${e.slug} (mutual)`);
		}
	}
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
			gapEntries: result.gapEntries,
			deviations: result.deviations,
			linkChanges: final.reduce((a, e) => a + e.linkLog.length, 0)
		},
		null,
		1
	)
);
console.log(
	`final.json: ${final.length} entries; fixed: ${final.filter((e) => e.fixedFields.length).length}; notes: ${notes.length}`
);
for (const n of notes) console.log('note', n);
