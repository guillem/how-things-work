// Extracts the existing catalogue (docs/TOPICS.md) into data/existing.json, the form the other
// scripts and the workflow arguments use. Run from the repository root: node docs/proposals/topics-200/scripts/extract-existing.mjs
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const DATA = path.resolve(here, '../data');
const md = fs.readFileSync(path.resolve(here, '../../../TOPICS.md'), 'utf8');
const cats = [];
const catRe = /^\| ([^|]+?) \| `([a-z]+)` \| (\d+) \|$/gm;
let m;
while ((m = catRe.exec(md))) cats.push({ name: m[1], id: m[2], count: +m[3] });
const topicsStart = md.indexOf('\n## Topics');
const reserveStart = md.indexOf('\n## Reserve');
const body = md.slice(topicsStart, reserveStart);
const entries = [];
let cat = null;
for (const block of body.split(/\n(?=###? |#### )/)) {
	const h3 = block.match(/^### (.+)/);
	if (h3) {
		cat = cats.find((c) => c.name === h3[1].trim())?.id;
		continue;
	}
	const h4 = block.match(/^#### ([a-z0-9-]+)/);
	if (!h4) continue;
	const f = (n) => {
		const r = block.match(new RegExp('^- \\*\\*' + n + ':\\*\\* (.+)$', 'm'));
		return r ? r[1].trim() : '';
	};
	const list = (s) =>
		s === 'none' || !s
			? []
			: s
					.split(',')
					.map((x) => x.trim())
					.filter(Boolean);
	entries.push({
		slug: h4[1],
		category: cat,
		title: f('Title'),
		level: +f('Level'),
		kind: f('Kind'),
		prerequisites: list(f('Prerequisites')),
		related: list(f('Related')),
		takeaway: f('Takeaway'),
		needs: f('Needs'),
		interaction: f('Interaction')
	});
}
const reserve = md
	.slice(reserveStart)
	.split('\n')
	.filter((l) => l.startsWith('- '))
	.map((l) => l.slice(2));
fs.mkdirSync(DATA, { recursive: true });
fs.writeFileSync(
	path.join(DATA, 'existing.json'),
	JSON.stringify({ categories: cats, existing: entries, reserve }, null, 1)
);
// The compact form the workflow scripts take as `args` (see ../README.md).
const args = {
	today: new Date().toISOString().slice(0, 10),
	categories: cats.map((c) => ({ id: c.id, name: c.name, count: c.count })),
	reserve,
	existing: entries.map((e) => [
		e.slug,
		e.category,
		e.level,
		e.kind,
		e.title,
		e.prerequisites.join(','),
		e.related.join(',')
	])
};
fs.writeFileSync(path.join(DATA, 'workflow-args.json'), JSON.stringify(args));
console.log(
	`${entries.length} entries, ${cats.length} categories, ${reserve.length} reserve items -> data/existing.json, data/workflow-args.json`
);
