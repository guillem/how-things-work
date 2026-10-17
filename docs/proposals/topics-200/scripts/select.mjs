// Phase B, local part: scores the pool from the collected merge and judge results, selects by
// quota, applies the curator's same-level swaps (when collected), and writes data/selection.json.
// Inputs (collect-stage.mjs output, any number of files): data/stages/merge-*.json,
// data/stages/judge-*.json, data/stages/curator*.json. Later files win for the same label.
// Usage: node select.mjs
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const DATA = path.resolve(here, '../data');
const STAGES = path.join(DATA, 'stages');
// Level split and per-category targets. On 2026-10-18 the user asked to lean towards AI where the
// split has to be uneven (ideally a complete ladder for understanding LLMs) and chose to take the
// AI slots from level 0: 39 / 10 / 3 / 48 instead of 45 / 10 / 3 / 42.
const QUOTA = { 0: 39, 1: 10, 2: 3, 3: 48 };
const L3_TARGET = {
	math: 5,
	physics: 2,
	chemistry: 5,
	biology: 5,
	medicine: 4,
	earth: 4,
	space: 2,
	computing: 2,
	networks: 5,
	ai: 9,
	energy: 5
};
const L0_TARGET = {
	math: 3,
	physics: 5,
	chemistry: 3,
	biology: 4,
	medicine: 4,
	earth: 3,
	space: 3,
	computing: 3,
	networks: 3,
	ai: 3,
	energy: 5
};
const CAT_MAX = 12;
const capOf = (c) => (c === 'ai' ? 18 : CAT_MAX);
// The LLM ladder: AI's level-3 cell is filled one page per stage first (the best-ranked
// eligible candidate of each stage), so that with the existing pages (embeddings,
// language-models, transformers...) the ladder runs from tokens to serving. The rungs left
// out are listed in the proposal as the ladder's second wave.
const LADDER = [
	['tokenization'],
	['training-a-tiny-language-model'],
	['positional-encoding'],
	['residual-stream-logit-lens'],
	['scaling-laws'],
	['rlhf-alignment', 'instruction-tuning'],
	['chain-of-thought-scratchpad', 'reasoning-rl-verifiable-rewards'],
	['kv-cache-inference', 'long-context-attention-cost'],
	['mixture-of-experts', 'weight-quantization', 'speculative-decoding', 'lora-fine-tuning']
];
// LLM serving pages filed in computing by their generator; they belong with the ladder.
const CATEGORY_OVERRIDE = { 'kv-cache-inference': 'ai', 'long-context-attention-cost': 'ai' };
const CAT_IDS = JSON.parse(
	fs.readFileSync(path.join(DATA, 'workflow-args.json'), 'utf8')
).categories.map((c) => c.id);
const norm = (s) =>
	String(s || '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

const rows = JSON.parse(fs.readFileSync(path.join(DATA, 'phase-b-args.json'), 'utf8')).rows;
let pool = rows.map((r) => ({
	slug: r[0],
	level: r[1],
	category: CATEGORY_OVERRIDE[r[0]] || r[2],
	kind: r[3],
	title: r[4],
	batch: r[5]
}));

function collected(prefix) {
	const byLabel = {};
	for (const f of fs
		.readdirSync(STAGES)
		.filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
		.sort()) {
		for (const r of JSON.parse(fs.readFileSync(path.join(STAGES, f), 'utf8')))
			byLabel[r.label] = r.result;
	}
	return byLabel;
}

// --- merge ---
const merges = collected('merge-');
const mergedCats = Object.keys(merges).map((l) => l.slice('merge:'.length));
const missingMerge = CAT_IDS.filter((c) => !mergedCats.includes(c));
const dropped = new Map();
const keepOf = new Map(); // dropped slug -> the slug its merge group kept
for (const m of Object.values(merges)) {
	for (const g of m.groups || [])
		for (const d of g.drop || [])
			if (norm(d) !== norm(g.keep)) {
				dropped.set(norm(d), `merged into ${norm(g.keep)}: ${g.reason}`);
				keepOf.set(norm(d), norm(g.keep));
			}
	for (const d of m.duplicatesOfExisting || [])
		dropped.set(norm(d.slug), `duplicate of existing ${d.existing}: ${d.reason}`);
}

// --- judge ---
const judges = collected('judge-');
const verdicts = {};
const judgedPairs = new Set();
for (const [label, r] of Object.entries(judges)) {
	const [, lens, b] = label.split(':');
	judgedPairs.add(`${lens}:${b}`);
	for (const v of r.verdicts || []) {
		const s = norm(v.slug);
		verdicts[s] = (verdicts[s] || []).filter((x) => x.lens !== lens);
		verdicts[s].push({ ...v, lens });
	}
}
const batchNos = [...new Set(rows.map((r) => r[5]))].sort((a, b) => a - b);
const missingJudge = batchNos.flatMap((n) =>
	['fit-level', 'build'].filter((l) => !judgedPairs.has(`${l}:b${n}`)).map((l) => `${l}:b${n}`)
);
for (const e of pool) {
	const vs = verdicts[e.slug] || [];
	e.scores = {};
	for (const v of vs) e.scores[v.lens] = v.score;
	const got = Object.keys(e.scores).length;
	e.score = got ? (Object.values(e.scores).reduce((a, b) => a + b, 0) / got) * 3 : 0;
	e.rejected = vs.some((v) => v.reject);
	e.rejectReasons = vs.filter((v) => v.reject).map((v) => `${v.lens}: ${v.reason}`);
	e.judgeNotes = vs.map((v) => `${v.lens} ${v.score}: ${v.reason}`);
	const lv = vs.find((v) => v.lens === 'fit-level');
	if (lv && lv.suggestedLevel !== e.level && !lv.reject) {
		e.originalLevel = e.level;
		e.level = lv.suggestedLevel;
	}
}
// Merge drops apply after judging. When a judge rejected the candidate a merge group kept
// (usually as a duplicate of the very one it absorbed), the dropped members come back.
const bySlug = Object.fromEntries(pool.map((e) => [e.slug, e]));
const restored = [];
for (const [d, k] of keepOf)
	if (bySlug[k] && bySlug[k].rejected) {
		dropped.delete(d);
		restored.push(`${d} (its merge kept ${k}, which a judge rejected)`);
	}
const mergedOut = pool
	.filter((e) => dropped.has(e.slug))
	.map((e) => ({
		slug: e.slug,
		level: e.level,
		category: e.category,
		title: e.title,
		why: dropped.get(e.slug)
	}));
pool = pool.filter((e) => !dropped.has(e.slug));
const unjudged = pool.filter((e) => !Object.keys(e.scores).length).map((e) => e.slug);
const halfJudged = pool.filter((e) => Object.keys(e.scores).length === 1).map((e) => e.slug);

// --- select by quota (as the single-run script did) ---
const eligible = pool.filter((e) => !e.rejected && e.score > 0);
// Scores are means of two 1-to-5 marks, so ties are common. Ties go to the higher fit-level
// mark (fit, honest level and distinctness), then to AI (the user's tilt), then to Reserve promotions, then to the demand
// lens's candidates, then to a
// fixed hash of the slug (not the alphabet, which would favour early letters).
const ORIGIN = Object.fromEntries(
	JSON.parse(fs.readFileSync(path.join(DATA, 'pool.json'), 'utf8')).map((e) => [e.slug, e.origin])
);
// Candidates a generator named as the promotion of one of the catalogue's 14 Reserve items: the
// catalogue already shortlisted those subjects, so they win exact ties after AI.
const RESERVE = new Set(
	JSON.parse(fs.readFileSync(path.join(DATA, 'dispositions.json'), 'utf8'))
		.filter((d) => d.decision !== 'drop')
		.map((d) => norm(d.slug))
);
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
const rank = (a, b) =>
	b.score - a.score ||
	(b.scores['fit-level'] || 0) - (a.scores['fit-level'] || 0) ||
	(b.category === 'ai') - (a.category === 'ai') ||
	(RESERVE.has(b.slug) ? 1 : 0) - (RESERVE.has(a.slug) ? 1 : 0) ||
	(ORIGIN[b.slug] === 'demand') - (ORIGIN[a.slug] === 'demand') ||
	hash(a.slug) - hash(b.slug);
const byScore = [...eligible].sort(rank);
const notes = [];
function selectByQuota() {
	const chosen = [];
	const chosenSlugs = new Set();
	const catCount = {};
	const levelCount = { 0: 0, 1: 0, 2: 0, 3: 0 };
	const take = (c) => {
		chosen.push(c);
		chosenSlugs.add(c.slug);
		catCount[c.category] = (catCount[c.category] || 0) + 1;
		levelCount[c.level]++;
	};
	for (const stage of LADDER) {
		const best = byScore.find(
			(c) => stage.includes(c.slug) && c.level === 3 && c.category === 'ai'
		);
		if (best) take(best);
		else notes.push(`LLM ladder: no eligible level-3 AI candidate for ${stage.join(' / ')}`);
	}
	for (const [level, targets] of [
		[3, L3_TARGET],
		[0, L0_TARGET]
	]) {
		for (const cat of CAT_IDS) {
			const want = Math.max(
				0,
				(targets[cat] || 0) - chosen.filter((c) => c.level === level && c.category === cat).length
			);
			const cell = byScore.filter(
				(c) => c.level === level && c.category === cat && !chosenSlugs.has(c.slug)
			);
			if (cell.length < want)
				notes.push(`cell L${level}/${cat}: only ${cell.length} eligible for a target of ${want}`);
			cell.slice(0, want).forEach(take);
		}
	}
	for (const level of [0, 3, 1, 2]) {
		for (const c of byScore) {
			if (levelCount[level] >= QUOTA[level]) break;
			if (c.level !== level || chosenSlugs.has(c.slug)) continue;
			if ((catCount[c.category] || 0) >= capOf(c.category)) continue;
			take(c);
		}
		if (levelCount[level] < QUOTA[level])
			notes.push(`level ${level}: ${levelCount[level]} of ${QUOTA[level]} slots filled`);
	}
	return chosen;
}
let selected = selectByQuota();
const quotaSelected = selected.map((e) => e.slug);
let runnersUp = byScore.filter((e) => !selected.includes(e));

// --- curator swaps ---
const curator = Object.values(collected('curator'))[0];
const curatorSwaps = [];
// The user chose to take AI's extra slots from level 0, keeping every other category's targets,
// so a swap across categories may not leave a category below its target at that level.
const targetOf = (level, cat) =>
	(level === 3 ? L3_TARGET[cat] : level === 0 ? L0_TARGET[cat] : 0) || 0;
// Swaps decided by hand after the curator: the curator's own same-category alternative where its
// cross-category swap was refused.
const EDITOR_SWAPS = [
	{
		out: 'tennis-racket-theorem',
		in: 'ising-model',
		reason:
			"The curator swapped tennis-racket-theorem for lasers; with the Reserve tie-break lasers enters by itself and pushed out ising-model on a hash tie instead, so this restores the curator's intent: the narrower rigid-body curiosity goes, phase transitions stay."
	},
	{
		out: 'sink-or-float',
		in: 'salt-and-ice',
		reason:
			'sink-or-float is the same density-in-a-tank page as floating-sinking-and-boats; salt-and-ice is the alternative the curator named for keeping chemistry at three level-0 pages.'
	}
];
function applySwap(s, who) {
	const out = selected.find((e) => e.slug === norm(s.out));
	const inn = runnersUp.find((e) => e.slug === norm(s.in));
	if (!out || !inn) return notes.push(`${who} swap ignored (unknown slug): ${s.out} -> ${s.in}`);
	const stageOf = (slug) => LADDER.findIndex((st) => st.includes(slug));
	if (stageOf(out.slug) >= 0 && stageOf(out.slug) !== stageOf(inn.slug))
		return notes.push(`${who} swap ignored (would remove an LLM-ladder rung): ${s.out} -> ${s.in}`);
	if (out.level !== inn.level)
		return notes.push(
			`${who} swap ignored (level differs): ${s.out} (L${out.level}) -> ${s.in} (L${inn.level})`
		);
	const left =
		selected.filter((e) => e.level === out.level && e.category === out.category).length - 1;
	if (out.category !== inn.category && left < targetOf(out.level, out.category))
		return notes.push(
			`${who} swap ignored (would leave ${out.category} below its level-${out.level} target): ${s.out} -> ${s.in}`
		);
	if (
		inn.category !== out.category &&
		selected.filter((e) => e.category === inn.category).length >= capOf(inn.category)
	)
		return notes.push(`${who} swap ignored (${inn.category} is at its cap): ${s.out} -> ${s.in}`);
	selected = selected.filter((e) => e !== out).concat(inn);
	runnersUp = runnersUp.filter((e) => e !== inn).concat(out);
	curatorSwaps.push({ out: out.slug, in: inn.slug, reason: s.reason, by: who });
}
if (curator) for (const s of curator.swaps || []) applySwap(s, 'curator');
for (const s of EDITOR_SWAPS) applySwap(s, 'editor');
runnersUp.sort(rank);

const count = (list, k) => list.reduce((a, e) => ((a[e[k]] = (a[e[k]] || 0) + 1), a), {});
const strip = (e) => ({
	slug: e.slug,
	ladder: LADDER.some((st) => st.includes(e.slug)) || undefined,
	ladderStage:
		LADDER.findIndex((st) => st.includes(e.slug)) >= 0
			? LADDER.findIndex((st) => st.includes(e.slug))
			: undefined,
	level: e.level,
	originalLevel: e.originalLevel,
	category: e.category,
	kind: e.kind,
	title: e.title,
	score: Math.round(e.score * 100) / 100,
	scores: e.scores,
	judgeNotes: e.judgeNotes
});
const out = {
	coverage: {
		missingMerge,
		missingJudge,
		unjudged: unjudged.length,
		halfJudged: halfJudged.length
	},
	poolSize: pool.length,
	counts: {
		byLevel: count(selected, 'level'),
		byCategory: count(selected, 'category'),
		byKind: count(selected, 'kind')
	},
	eligibleByLevel: count(eligible, 'level'),
	notes,
	mergedOut,
	restored,
	rejectedByJudges: pool
		.filter((e) => e.rejected)
		.map((e) => ({
			slug: e.slug,
			level: e.level,
			category: e.category,
			title: e.title,
			reasons: e.rejectReasons
		})),
	relevelled: pool
		.filter((e) => e.originalLevel !== undefined)
		.map((e) => `${e.slug}: L${e.originalLevel} -> L${e.level}`),
	quotaSelected,
	curatorSwaps,
	curatorOverlaps: curator ? curator.overlaps : [],
	curatorNotes: curator ? curator.notes : '',
	selected: selected.map(strip),
	runnersUp: runnersUp.map(strip)
};
fs.writeFileSync(path.join(DATA, 'selection.json'), JSON.stringify(out, null, 1));
console.log(
	`merge: ${mergedOut.length} dropped (${missingMerge.length ? 'missing ' + missingMerge.join(',') : 'all categories'}); ` +
		`judge: ${missingJudge.length ? missingJudge.length + ' passes missing' : 'complete'}, ${unjudged.length} unjudged, ${halfJudged.length} with one judge; ` +
		`${out.rejectedByJudges.length} rejected, ${out.relevelled.length} re-levelled`
);
for (const r of restored) console.log('restored', r);
console.log(`eligible by level ${JSON.stringify(out.eligibleByLevel)}`);
console.log(
	`selected ${selected.length}: ${JSON.stringify(out.counts.byLevel)} ${JSON.stringify(out.counts.byCategory)}`
);
console.log(
	`curator: ${curator ? curatorSwaps.length + ' swaps applied' : 'not collected'}; ${runnersUp.length} runners-up`
);
for (const n of notes) console.log('note', n);
