// Promotes one proposed entry from data/final.json into docs/TOPICS.md, keeping the catalogue's
// invariants: the entry goes at the end of its category (and its checklist line at the end of
// that category's checklist block, unticked), the category count and the preamble's total grow
// by one, Related keeps only slugs already in the catalogue and each of those gets the reverse
// link. Prerequisites must already be in the catalogue. The proposal notes (Leads to, Why...)
// are not copied. Run it when a topic's build starts; tick the checklist line when it is done.
// Usage: node promote.mjs <slug>
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const FINAL = path.resolve(here, '../data/final.json');
const TOPICS = path.resolve(here, '../../../TOPICS.md');
const slug = process.argv[2];
const e = JSON.parse(fs.readFileSync(FINAL, 'utf8')).find((x) => x.slug === slug);
if (!e) throw new Error(`${slug} is not in final.json`);

let lines = fs.readFileSync(TOPICS, 'utf8').split('\n');
const has = (s) => lines.some((l) => l === `#### ${s}`);
if (has(slug)) throw new Error(`${slug} is already in TOPICS.md`);
const missing = e.prerequisites.filter((p) => !has(p));
if (missing.length)
	throw new Error(`${slug}: prerequisites not in the catalogue yet: ${missing.join(', ')}`);
if (e.level === 0 && !lines.some((l) => /^\|\s*0\s*\|/.test(l)))
	throw new Error('level 0 is not in the Levels table yet (and the parser must accept it)');

const related = e.related.filter((r) => has(r) && !e.prerequisites.includes(r));
const deferred = e.related.filter((r) => !has(r));

// Category name from the categories table (| Name | `id` | n |).
const catRow = lines.findIndex((l) =>
	new RegExp(`^\\|[^|]+\\|\\s*\`${e.category}\`\\s*\\|`).test(l)
);
if (catRow < 0) throw new Error(`category ${e.category} not in the table`);
const catName = lines[catRow].split('|')[1].trim();
lines[catRow] = lines[catRow].replace(/\|\s*(\d+)\s*\|\s*$/, (m, n) => `| ${Number(n) + 1} |`);
const total = lines.findIndex((l) => /It defines \d+ topics in/.test(l));
if (total >= 0)
	lines[total] = lines[total].replace(
		/It defines (\d+) topics/,
		(m, n) => `It defines ${Number(n) + 1} topics`
	);

// Reverse Related links.
for (const r of related) {
	const h = lines.indexOf(`#### ${r}`);
	let i = h + 1;
	let relLine = -1;
	let preLine = -1;
	for (; i < lines.length && lines[i].startsWith('- **'); i++) {
		if (lines[i].startsWith('- **Related:**')) relLine = i;
		if (lines[i].startsWith('- **Prerequisites:**')) preLine = i;
	}
	if (relLine >= 0) lines[relLine] = `${lines[relLine]}, ${slug}`;
	else lines.splice(preLine + 1, 0, `- **Related:** ${slug}`);
}

// The entry, at the end of its category section.
const field = (k, v) =>
	v !== undefined && v !== null && String(v).trim() ? [`- **${k}:** ${String(v).trim()}`] : [];
const block = [
	`#### ${slug}`,
	...field('Title', e.title),
	...field('Level', e.level),
	...field('Kind', e.kind),
	...field('Interaction', e.interaction),
	...field('Takeaway', e.takeaway),
	`- **Prerequisites:** ${e.prerequisites.length ? e.prerequisites.join(', ') : 'none'}`,
	...(related.length ? [`- **Related:** ${related.join(', ')}`] : []),
	...field('Needs', e.needs),
	...field('Pitfall', e.pitfall),
	''
];
const topicsStart = lines.indexOf('## Topics');
const catHead = lines.findIndex((l, i) => i > topicsStart && l === `### ${catName}`);
let end = lines.findIndex((l, i) => i > catHead && (l.startsWith('### ') || l.startsWith('## ')));
if (end < 0) end = lines.length;
while (lines[end - 1] === '') end--;
lines.splice(end, 0, '', ...block.slice(0, -1));

// Checklist line, at the end of the category's block.
const ck = lines.indexOf('## Checklist');
const ckHead = lines.findIndex((l, i) => i > ck && l === `**${catName}**`);
let ckEnd = ckHead + 1;
while (lines[ckEnd] && lines[ckEnd].startsWith('- [')) ckEnd++;
lines.splice(ckEnd, 0, `- [ ] ${slug}`);

fs.writeFileSync(TOPICS, lines.join('\n'));
console.log(
	`${slug} promoted into ${catName}` +
		(related.length ? `; Related ${related.join(', ')} (reverse links added)` : '') +
		(deferred.length
			? `; Related not in the catalogue yet, left for when they are promoted: ${deferred.join(', ')}`
			: '')
);
