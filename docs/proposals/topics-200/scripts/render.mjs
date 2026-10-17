// Validates the proposed entries against the existing catalogue and renders them
// in the catalogue's entry format. Usage: node render.mjs <final.json | entries dir> <routes dir>
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const DATA = path.resolve(here, '../data');
const existingAll = JSON.parse(fs.readFileSync(path.join(DATA, 'existing.json'), 'utf8'));
const EXISTING = existingAll.existing;
const CATS = existingAll.categories;
const EX = Object.fromEntries(EXISTING.map((e) => [e.slug, e]));
const KINDS = ['manipulate', 'simulate', 'step', 'build', 'explore'];

const src = process.argv[2];
const routesDir = process.argv[3];
let proposed = [];
if (fs.statSync(src).isDirectory()) {
	for (const f of fs
		.readdirSync(src)
		.filter((f) => f.endsWith('.json'))
		.sort()) {
		proposed.push(...JSON.parse(fs.readFileSync(path.join(src, f), 'utf8')));
	}
} else {
	proposed = JSON.parse(fs.readFileSync(src, 'utf8'));
	if (!Array.isArray(proposed)) proposed = proposed.final;
}
const routes = routesDir ? new Set(fs.readdirSync(routesDir)) : new Set();

const problems = [];
const warnings = [];
const P = Object.fromEntries(proposed.map((e) => [e.slug, e]));
const levelOf = (s) => (EX[s] ? EX[s].level : P[s] ? P[s].level : undefined);

// --- invariants ---
const slugs = proposed.map((e) => e.slug);
if (new Set(slugs).size !== slugs.length)
	problems.push('duplicate slugs among the proposed entries');
for (const e of proposed) {
	if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.slug)) problems.push(`${e.slug}: bad slug`);
	if (EX[e.slug]) problems.push(`${e.slug}: already in the catalogue`);
	if (routes.has(e.slug)) problems.push(`${e.slug}: a route of that name already exists`);
	if (![0, 1, 2, 3].includes(e.level)) problems.push(`${e.slug}: level ${e.level}`);
	if (!KINDS.includes(e.kind)) problems.push(`${e.slug}: kind ${e.kind}`);
	if (!CATS.some((c) => c.id === e.category)) problems.push(`${e.slug}: category ${e.category}`);
	for (const k of ['title', 'interaction', 'takeaway', 'why', 'overlapWith']) {
		if (!e[k] || !String(e[k]).trim()) problems.push(`${e.slug}: empty ${k}`);
	}
	for (const p of e.prerequisites) {
		if (levelOf(p) === undefined) problems.push(`${e.slug}: prerequisite ${p} does not exist`);
		else if (levelOf(p) > e.level)
			problems.push(`${e.slug} (L${e.level}): prerequisite ${p} is L${levelOf(p)}`);
		if (e.related.includes(p)) problems.push(`${e.slug}: ${p} is both a prerequisite and related`);
	}
	for (const r of e.related) {
		if (levelOf(r) === undefined) problems.push(`${e.slug}: related ${r} does not exist`);
		else if (P[r] && !P[r].related.includes(e.slug))
			problems.push(`${e.slug}: related ${r} is not mutual`);
		if (P[r] && P[r].prerequisites.includes(e.slug))
			problems.push(`${e.slug}: related ${r} lists it as a prerequisite`);
	}
	if (e.level === 0 && e.prerequisites.some((p) => levelOf(p) > 0))
		problems.push(`${e.slug}: level-0 topic with a non-level-0 prerequisite`);
	for (const l of e.leadsTo || []) {
		if (!EX[l]) warnings.push(`${e.slug}: leadsTo ${l} is not an existing topic`);
	}
	if (e.level === 0 && !(e.leadsTo || []).length)
		warnings.push(`${e.slug}: level 0 without a leadsTo`);
	if (
		e.needs &&
		!/\b(CC|public domain|MIT|open|licen|BSD|Apache|ODbL|GPL|PD)/i.test(
			e.needs + ' ' + (e.needsSource || '')
		)
	) {
		warnings.push(`${e.slug}: Needs without a licence word: ${e.needs.slice(0, 80)}`);
	}
}
// cycles over existing + proposed
const graph = {};
for (const x of EXISTING) graph[x.slug] = x.prerequisites;
for (const e of proposed) graph[e.slug] = e.prerequisites;
const state = {};
const visit = (n, stack) => {
	if (state[n] === 2) return;
	if (state[n] === 1) {
		problems.push(`cycle: ${[...stack, n].join(' -> ')}`);
		return;
	}
	state[n] = 1;
	for (const p of graph[n] || []) if (graph[p]) visit(p, [...stack, n]);
	state[n] = 2;
};
for (const n of Object.keys(graph)) visit(n, []);

// --- back-links the existing entries would need ---
const backlinks = [];
for (const e of proposed)
	for (const r of e.related) if (EX[r]) backlinks.push({ existing: r, add: e.slug });
// topics that would list an existing topic as a prerequisite (the existing page then links "builds on this")
const buildsOn = [];
for (const e of proposed)
	for (const p of e.prerequisites) if (EX[p]) buildsOn.push({ existing: p, by: e.slug });

// --- counts ---
const count = (list, key) => list.reduce((a, e) => ((a[key(e)] = (a[key(e)] || 0) + 1), a), {});
const byLevelBefore = count(EXISTING, (e) => e.level);
const byLevelNew = count(proposed, (e) => e.level);
const byLevelAfter = {};
for (const l of [0, 1, 2, 3]) byLevelAfter[l] = (byLevelBefore[l] || 0) + (byLevelNew[l] || 0);
const cell = (list, c, l) => list.filter((e) => e.category === c && e.level === l).length;
const kinds = count(proposed, (e) => e.kind);
const everyday = proposed.filter((e) => e.everyday);

// --- render ---
const field = (name, value) =>
	value !== undefined && value !== null && String(value).trim()
		? `- **${name}:** ${String(value).trim()}\n`
		: ''; // level 0 is falsy but must render
const list = (a) => (a && a.length ? a.join(', ') : 'none');
let md = '';
for (const c of CATS) {
	const items = proposed
		.filter((e) => e.category === c.id)
		.sort((a, b) => a.level - b.level || a.slug.localeCompare(b.slug));
	if (!items.length) continue;
	md += `### ${c.name}\n\n`;
	for (const e of items) {
		md += `#### ${e.slug}\n`;
		md += field('Title', e.title);
		md += field('Level', e.level);
		md += field('Kind', e.kind);
		md += field('Interaction', e.interaction);
		md += field('Takeaway', e.takeaway);
		md += `- **Prerequisites:** ${list(e.prerequisites)}\n`;
		if (e.related.length) md += `- **Related:** ${e.related.join(', ')}\n`;
		md += field('Needs', e.needs);
		md += field('Pitfall', e.pitfall);
		const notes = [];
		if (e.leadsTo && e.leadsTo.length) notes.push(`Leads to: ${e.leadsTo.join(', ')}`);
		notes.push(`Nearest existing: ${e.overlapWith}`);
		notes.push(`Why: ${e.why}`);
		if (e.needsSource && !/^none/i.test(e.needsSource.trim())) notes.push(`Data: ${e.needsSource}`);
		md += notes.map((n) => `  > ${n}`).join('\n') + '\n\n';
	}
}

const table = [];
table.push('| Level | Today | New | After |');
table.push('|---|---|---|---|');
for (const l of [0, 1, 2, 3])
	table.push(`| ${l} | ${byLevelBefore[l] || 0} | ${byLevelNew[l] || 0} | ${byLevelAfter[l]} |`);
table.push(
	`| **Total** | **${EXISTING.length}** | **${proposed.length}** | **${EXISTING.length + proposed.length}** |`
);

const grid = [];
grid.push('| Category | Today | New | After | L0 | L1 | L2 | L3 |');
grid.push('|---|---|---|---|---|---|---|---|');
for (const c of CATS) {
	const nw = proposed.filter((e) => e.category === c.id).length;
	const old = EXISTING.filter((e) => e.category === c.id).length;
	const cells = [0, 1, 2, 3].map(
		(l) => `${cell(EXISTING, c.id, l) + cell(proposed, c.id, l)} (+${cell(proposed, c.id, l)})`
	);
	grid.push(`| ${c.name} | ${old} | ${nw} | ${old + nw} | ${cells.join(' | ')} |`);
}
grid.push(
	`| **Total** | **${EXISTING.length}** | **${proposed.length}** | **${EXISTING.length + proposed.length}** | ${[0, 1, 2, 3].map((l) => `**${byLevelAfter[l]}** (+${byLevelNew[l] || 0})`).join(' | ')} |`
);

const checklist = CATS.map((c) => {
	const items = proposed
		.filter((e) => e.category === c.id)
		.sort((a, b) => a.level - b.level || a.slug.localeCompare(b.slug));
	return items.length ? `**${c.name}**\n${items.map((e) => `- [ ] ${e.slug}`).join('\n')}` : '';
})
	.filter(Boolean)
	.join('\n\n');

const out = {
	problems,
	warnings,
	counts: {
		byLevelBefore,
		byLevelNew,
		byLevelAfter,
		kinds,
		everyday: everyday.length,
		total: proposed.length
	},
	backlinks,
	buildsOn
};
fs.writeFileSync(path.join(DATA, 'entries.md'), md);
fs.writeFileSync(path.join(DATA, 'tables.md'), table.join('\n') + '\n\n' + grid.join('\n') + '\n');
fs.writeFileSync(path.join(DATA, 'checklist.md'), checklist + '\n');
fs.writeFileSync(path.join(DATA, 'validation.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.counts));
console.log(
	`${problems.length} problems, ${warnings.length} warnings, ${backlinks.length} back-links, ${buildsOn.length} builds-on links`
);
for (const p of problems) console.log('PROBLEM', p);
for (const w of warnings) console.log('warning', w);
