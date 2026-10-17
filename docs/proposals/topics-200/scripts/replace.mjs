// Phase C, local part. Recomputes, from every collected verdict so far, the verified hundred:
// a refuted topic (no fix) is replaced by the best untried runner-up at the same level, same
// category first, then any category under 12; a topic with no verdict yet is pending. Writes
// data/verified.json and data/stages/next-verify.json (the stage fields for the next verify run).
// Once nothing is pending, the critics' candidates go to data/stages/next-gapverify.json, and the
// verified gap entries replace the lowest-scoring topic at the same level (at most 10 swaps).
// Inputs: data/selection.json, data/stages/verify-*.json, critic-*.json, gapverify-*.json.
// Usage: node replace.mjs [--accept-unverified]  (treats topics still without a verdict as passed)
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const DATA = path.resolve(here, '../data');
const STAGES = path.join(DATA, 'stages');
const CAT_MAX = 12;
const GAP_SWAPS = 10;
const KINDS = ['manipulate', 'simulate', 'step', 'build', 'explore'];
const acceptUnverified = process.argv.includes('--accept-unverified');
const norm = (s) =>
	String(s || '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
const existing = new Set(
	JSON.parse(fs.readFileSync(path.join(DATA, 'existing.json'), 'utf8')).existing.map((e) => e.slug)
);
const sel = JSON.parse(fs.readFileSync(path.join(DATA, 'selection.json'), 'utf8'));
function collected(prefix) {
	const byLabel = {};
	for (const f of fs
		.readdirSync(STAGES)
		.filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
		.sort())
		for (const r of JSON.parse(fs.readFileSync(path.join(STAGES, f), 'utf8')))
			byLabel[r.label] = r.result;
	return byLabel;
}
function verdictsOf(prefix) {
	const v = {};
	for (const r of Object.values(collected(prefix)))
		for (const x of r.verdicts || []) v[norm(x.slug)] = x;
	return v;
}
function withFix(row, v) {
	const e = { ...row, verifyNote: v.reason };
	if (v.hasFix && v.fixed && Object.keys(v.fixed).length) {
		e.fix = v.fixed;
		if (v.fixed.level !== undefined && v.fixed.level !== null)
			e.level = Math.max(0, Math.min(3, Math.round(Number(v.fixed.level))));
		if (v.fixed.kind && KINDS.includes(v.fixed.kind)) e.kind = v.fixed.kind;
		if (v.fixed.title) e.title = v.fixed.title;
	}
	return e;
}
const catCounts = (list) =>
	list.reduce((a, e) => ((a[e.category] = (a[e.category] || 0) + 1), a), {});

// --- verification with replacement ---
const V = verdictsOf('verify-');
const runners = sel.runnersUp.map((r) => ({ ...r }));
const tried = new Set(sel.selected.map((e) => e.slug));
const queue = sel.selected.map((e) => ({ ...e }));
const final = [];
const pending = [];
const rejectedInVerify = [];
const deviations = [];
const unverified = [];
while (queue.length) {
	const e = queue.shift();
	const v = V[e.slug];
	if (!v) {
		if (acceptUnverified) {
			final.push({ ...e, verifyNote: 'not verified (no verdict after two runs)' });
			unverified.push(e.slug);
		} else pending.push(e);
		continue;
	}
	if (!(v.refuted && !v.hasFix)) {
		final.push(withFix(e, v));
		continue;
	}
	rejectedInVerify.push({
		slug: e.slug,
		level: e.level,
		category: e.category,
		title: e.title,
		reason: v.reason
	});
	const cc = catCounts([...final, ...pending, ...queue]);
	const cands = runners.filter((c) => !tried.has(c.slug) && c.level === e.level);
	let rep = cands.find((c) => c.category === e.category);
	if (!rep) {
		rep = cands.find((c) => (cc[c.category] || 0) < CAT_MAX);
		if (rep)
			deviations.push(
				`${e.slug} (L${e.level}/${e.category}) replaced from another category: ${rep.slug} (${rep.category})`
			);
	}
	if (!rep) {
		rep = runners.find((c) => !tried.has(c.slug) && (cc[c.category] || 0) < CAT_MAX);
		if (rep)
			deviations.push(
				`${e.slug} (L${e.level}) replaced at another level: ${rep.slug} (L${rep.level}/${rep.category})`
			);
	}
	if (!rep) {
		deviations.push(`no runner-up left for ${e.slug}; one slot stays open`);
		continue;
	}
	tried.add(rep.slug);
	queue.push({ ...rep, replaces: e.slug });
}
const runnersUp = runners.filter((c) => !tried.has(c.slug));

// --- gaps ---
const critics = collected('critic-');
const gapCands = [];
const criticNotes = [];
const finalSlugs = new Set(final.map((e) => e.slug));
for (const [label, r] of Object.entries(critics)) {
	criticNotes.push({ critic: label.slice('critic:'.length), missing: r.missing });
	for (const raw of r.candidates || []) {
		const slug = norm(raw.slug);
		if (
			!slug ||
			existing.has(slug) ||
			finalSlugs.has(slug) ||
			gapCands.some((x) => x.slug === slug)
		)
			continue;
		if (sel.runnersUp.some((x) => x.slug === slug) || sel.mergedOut.some((x) => x.slug === slug))
			continue;
		gapCands.push({ ...raw, slug, origin: `gap:${label.slice('critic:'.length)}` });
	}
}
const GV = verdictsOf('gapverify-');
const gapSwaps = [];
const gapEntries = [];
let gapPending = [];
if (!pending.length && gapCands.length) {
	gapPending = gapCands.filter((g) => !GV[g.slug]);
	for (const g0 of gapCands.filter((g) => GV[g.slug])) {
		const v = GV[g0.slug];
		if (v.refuted && !v.hasFix) {
			gapEntries.push({ ...g0, kept: 'refuted', verifyNote: v.reason });
			continue;
		}
		const g = { ...g0, verifyNote: v.reason };
		if (v.hasFix && v.fixed)
			for (const k of Object.keys(v.fixed))
				if (v.fixed[k] !== undefined && v.fixed[k] !== null && v.fixed[k] !== '' && k !== 'slug')
					g[k] = v.fixed[k];
		g.level = Math.max(0, Math.min(3, Math.round(Number(g.level))));
		if (gapSwaps.length >= GAP_SWAPS) {
			gapEntries.push({ ...g, kept: 'runner-up (swap budget used)' });
			continue;
		}
		const cc = catCounts(final);
		const victims = final
			.filter((e) => e.level === g.level && !String(e.origin || '').startsWith('gap'))
			.filter((e) => e.category === g.category || (cc[g.category] || 0) < CAT_MAX)
			.sort((a, b) => (a.score || 0) - (b.score || 0));
		if (!victims.length) {
			gapEntries.push({ ...g, kept: 'runner-up (no slot at its level)' });
			continue;
		}
		const out = victims[0];
		final.splice(final.indexOf(out), 1);
		final.push({
			slug: g.slug,
			level: g.level,
			category: g.category,
			kind: g.kind,
			title: g.title,
			score: 15,
			origin: g.origin,
			verifyNote: g.verifyNote
		});
		runnersUp.unshift(out);
		gapEntries.push({ ...g, kept: 'selected' });
		gapSwaps.push({
			out: out.slug,
			outTitle: out.title,
			in: g.slug,
			inTitle: g.title,
			level: g.level
		});
	}
}

const CAT_IDS = JSON.parse(
	fs.readFileSync(path.join(DATA, 'workflow-args.json'), 'utf8')
).categories.map((c) => c.id);
final.sort(
	(a, b) =>
		CAT_IDS.indexOf(a.category) - CAT_IDS.indexOf(b.category) ||
		a.level - b.level ||
		(a.slug < b.slug ? -1 : 1)
);
const count = (list, k) => list.reduce((a, e) => ((a[e[k]] = (a[e[k]] || 0) + 1), a), {});
const counts = {
	byLevel: count(final, 'level'),
	byCategory: count(final, 'category'),
	byKind: count(final, 'kind')
};
fs.writeFileSync(
	path.join(DATA, 'verified.json'),
	JSON.stringify(
		{
			counts,
			pending: pending.map((e) => e.slug),
			final,
			gapEntries,
			gapSwaps,
			rejectedInVerify,
			deviations,
			unverified,
			criticNotes,
			runnersUp
		},
		null,
		1
	)
);
const strip = (e) => ({
	slug: e.slug,
	level: e.level,
	originalLevel: e.originalLevel,
	category: e.category,
	kind: e.kind,
	title: e.title
});
const next = path.join(STAGES, 'next-verify.json');
if (pending.length)
	fs.writeFileSync(
		next,
		JSON.stringify({ stage: 'verify', tag: `n${Object.keys(V).length}`, rows: pending.map(strip) })
	);
else if (fs.existsSync(next)) fs.unlinkSync(next);
const nextGap = path.join(STAGES, 'next-gapverify.json');
if (gapPending.length)
	fs.writeFileSync(
		nextGap,
		JSON.stringify({ stage: 'gapverify', tag: `g${Object.keys(GV).length}`, entries: gapPending })
	);
else if (fs.existsSync(nextGap)) fs.unlinkSync(nextGap);
console.log(
	`final ${final.length} (${JSON.stringify(counts.byLevel)}); pending ${pending.length}; refuted ${rejectedInVerify.length}; ` +
		`critics ${Object.keys(critics).length}, gap candidates ${gapCands.length} (${gapPending.length} to verify), gap swaps ${gapSwaps.length}`
);
console.log(JSON.stringify(counts.byCategory));
for (const d of deviations) console.log('deviation', d);
if (pending.length) console.log(`next: make-run.mjs workflows/phase-c-verify.js @${next}`);
if (gapPending.length) console.log(`next: make-run.mjs workflows/phase-c-verify.js @${nextGap}`);
