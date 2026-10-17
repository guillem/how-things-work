// Writes docs/TOPICS-PROPOSAL.md from drafts/skeleton.md: the rendered entries and tables
// (render.mjs output), the hand-written drafts, and the lists computed here (everyday topics,
// links to add to existing entries, runners-up). Run after assemble.mjs and render.mjs; then
// run prettier on the result.
// Usage: node write-proposal.mjs
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(here, '..');
const DATA = path.join(ROOT, 'data');
const DRAFTS = path.join(ROOT, 'drafts');
const OUT = path.resolve(ROOT, '../../TOPICS-PROPOSAL.md');
const read = (p) => fs.readFileSync(p, 'utf8');
const json = (p) => JSON.parse(read(path.join(DATA, p)));

const existing = json('existing.json');
const CAT_NAME = Object.fromEntries(existing.categories.map((c) => [c.id, c.name]));
const final = json('final.json');
const selection = json('selection.json');
const verified = json('verified.json');
const validation = json('validation.json');
const pool = Object.fromEntries(json('pool.json').map((e) => [e.slug, e]));

// --- prose.md sections, split on <!-- NAME --> markers ---
const prose = {};
for (const part of read(path.join(DRAFTS, 'prose.md'))
	.split(/^<!-- ([A-Z_]+) -->$/m)
	.slice(1)
	.reduce((acc, x, i, a) => (i % 2 === 0 ? [...acc, [x, a[i + 1]]] : acc), []))
	prose[part[0]] = part[1].trim();

// --- computed pieces ---
const level0Everyday = final.filter((e) => e.level === 0 && e.everyday);
const everydayList = [
	'| Everyday topic | Filed under by default |',
	'| --- | --- |',
	...level0Everyday.map((e) => `| ${e.slug}: ${e.title} | ${CAT_NAME[e.category]} |`)
].join('\n');

const related = {};
for (const b of validation.backlinks) (related[b.existing] = related[b.existing] || []).push(b.add);
const buildsOn = {};
for (const b of validation.buildsOn) (buildsOn[b.existing] = buildsOn[b.existing] || []).push(b.by);
const exSlugs = existing.existing.map((e) => e.slug).filter((s) => related[s] || buildsOn[s]);
const backlinks = [
	'Each new entry that lists an existing topic under Related needs the reverse link in that',
	"existing entry (the catalogue's Related links are mutual). The third column is for information:",
	'the new pages that would list the existing one as a prerequisite.',
	'',
	'| Existing topic | Add to its Related | New pages that build on it |',
	'| --- | --- | --- |',
	...exSlugs.map(
		(s) =>
			`| ${s} | ${(related[s] || []).sort().join(', ') || ''} | ${(buildsOn[s] || []).sort().join(', ') || ''} |`
	)
].join('\n');

const marks = (e) => {
	const s = e.scores || {};
	return `${Math.round((e.score || 0) * 10) / 10} (fit ${s['fit-level'] ?? '?'}, build ${s.build ?? '?'})`;
};
const titleOf = (e) => e.title || (pool[e.slug] || {}).title || '';
const gapKept = verified.gapEntries.filter((g) => g.kept !== 'selected' && g.kept !== 'refuted');
const SECOND_WAVE = [
	'adaptive-optimizers',
	'weight-quantization',
	'mixture-of-experts',
	'lora-fine-tuning',
	'instruction-tuning',
	'reasoning-rl-verifiable-rewards',
	'long-context-attention-cost',
	'induction-heads',
	'superposition-toy-models',
	'retrieval-augmented-generation',
	'where-facts-live',
	'knowledge-distillation',
	'words-keep-company',
	'learning-by-reward'
];
// superposition-toy-models (a critic's verified entry) supersedes the pool's superposition-features
const SUPERSEDED = new Set(['superposition-features']);
const anyRow = (slug) =>
	gapKept.find((g) => g.slug === slug) ||
	verified.runnersUp.find((e) => e.slug === slug) ||
	selection.runnersUp.find((e) => e.slug === slug);
const row = (e) =>
	`| ${e.slug} | ${e.level} | ${CAT_NAME[e.category]} | ${titleOf(e)} | ${marks(e)} |`;
const head = [
	'| Slug | Level | Category | Title | Score (marks) |',
	'| --- | --- | --- | --- | --- |'
];
const secondWave = SECOND_WAVE.map(anyRow).filter(Boolean);
const shown = new Set([...SECOND_WAVE, ...gapKept.map((g) => g.slug), ...SUPERSEDED]);
const fit = (e) => (e.scores || {})['fit-level'] || 0;
const others = verified.runnersUp
	.filter((e) => !shown.has(e.slug))
	.sort((a, b) => (b.score || 0) - (a.score || 0) || fit(b) - fit(a))
	.slice(0, 30);
// the reviewer's reason in plain words, where its own first sentence is pipeline jargon
const REFUTED_NOTE = {
	'x-ray-diffraction':
		'it repeats crystal-diffraction, a physics candidate with the same mechanism and takeaway (a runner-up at 12); one page on diffraction from crystals could return later under either name'
};
const refuted = verified.rejectedInVerify;
const runnersUp = [
	"Every candidate that did not make the hundred is kept, with its scores and the judges' and",
	"reviewers' notes, in `docs/proposals/topics-200/data/` (`selection.json`, `verified.json`). The",
	"strongest of them are the natural new Reserve. Score is the mean of the two judges' marks",
	'(1 to 5) times three, so 15 is the top.',
	'',
	"**The LLM ladder's second wave.** Rungs left out of the ladder, several scoring as well as the pages selected; the",
	'two level-0 entries are further doors into the same subject.',
	'',
	...head,
	...secondWave.map(row),
	'',
	"**The completeness critics' finds.** Verified and judged like the rest, but each would have had",
	'to displace a higher-scored topic or break a category target to get in.',
	'',
	...head,
	...gapKept.filter((g) => !SECOND_WAVE.includes(g.slug)).map(row),
	'',
	'**The strongest other runners-up**, by score, then fit:',
	'',
	...head,
	...others.map(row),
	'',
	'**Refuted in review:** ' +
		refuted
			.map(
				(r) =>
					`${r.slug} (level ${r.level}, ${CAT_NAME[r.category]}): ${REFUTED_NOTE[r.slug] || r.reason.split('. ')[0]}.`
			)
			.join(' ')
].join('\n');

const nums = {
	GEN_COUNT: String(selection.poolSize + selection.mergedOut.length),
	MERGE_DROPPED: String(selection.mergedOut.length),
	JUDGE_REJECTED: String(selection.rejectedByJudges.length),
	RELEVELLED: String(selection.relevelled.length),
	VERIFY_REJECTED: String(refuted.length),
	VERIFY_FIXED: String(final.filter((e) => (e.fixedFields || []).length).length),
	GAP_SWAPS: String(verified.gapSwaps.length),
	EVERYDAY_COUNT: String(level0Everyday.length),
	EVERYDAY_LIST: everydayList
};
const fillNums = (t) => t.replace(/\{\{([A-Z_0-9]+)\}\}/g, (m, k) => (k in nums ? nums[k] : m));

const parts = {
	SUMMARY: read(path.join(DRAFTS, 'summary.md')).trim(),
	LEVEL0_FRAMEWORK_NOTE: read(path.join(DRAFTS, 'level0-note.md')).trim(),
	TABLES: read(path.join(DATA, 'tables.md')).trim(),
	EVENNESS_NOTE: prose.EVENNESS,
	CATEGORIES: fillNums(prose.CATEGORIES),
	LLM_LADDER: read(path.join(DRAFTS, 'llm-ladder.md')).trim(),
	RESERVE: read(path.join(DRAFTS, 'reserve.md')).trim(),
	ENTRIES: read(path.join(DATA, 'entries.md')).trim(),
	CHECKLIST: read(path.join(DATA, 'checklist.md')).trim(),
	BACKLINKS: backlinks,
	WAVES: prose.WAVES,
	FRAMEWORK: read(path.join(DRAFTS, 'framework.md')).trim(),
	RUNNERS_UP: runnersUp,
	METHOD: fillNums(prose.METHOD),
	OPEN_QUESTIONS: read(path.join(DRAFTS, 'open-questions.md')).trim()
};
let out = read(path.join(DRAFTS, 'skeleton.md'));
for (const [k, v] of Object.entries(parts)) {
	if (!out.includes(`{{${k}}}`)) throw new Error(`skeleton has no {{${k}}}`);
	out = out.replace(`{{${k}}}`, () => v);
}
const left = out.match(/\{\{[A-Z_0-9]+\}\}/g);
if (left) throw new Error(`unfilled placeholders: ${[...new Set(left)].join(', ')}`);
fs.writeFileSync(OUT, out);
const entries = (out.match(/^#### /gm) || []).length;
console.log(
	`${path.relative(process.cwd(), OUT)}: ${entries} entries, ${(out.length / 1024).toFixed(0)} KB`
);
