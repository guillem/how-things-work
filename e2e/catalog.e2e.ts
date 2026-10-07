// Checks the invariants that docs/TOPICS.md asks to keep true, plus the link
// between the catalogue and the built explainers. Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import { parseCatalog } from '../src/lib/catalog-parse';

const catalog = parseCatalog(fs.readFileSync('docs/TOPICS.md', 'utf8'));
const { entries, bySlug, categories, checklist } = catalog;

test('every slug is unique and the checklist lists exactly the entries, in order', () => {
	const slugs = entries.map((e) => e.slug);
	expect(new Set(slugs).size).toBe(slugs.length);
	expect(checklist.map((c) => c.slug)).toEqual(slugs);
	for (const item of checklist) expect(item.category).toBe(bySlug.get(item.slug)?.category);
});

test('every entry has the required fields', () => {
	for (const e of entries) {
		expect(e.title, e.slug).toBeTruthy();
		expect(['manipulate', 'simulate', 'step', 'build', 'explore'], e.slug).toContain(e.kind);
		expect(e.interaction, e.slug).toBeTruthy();
		expect(e.takeaway, e.slug).toBeTruthy();
	}
});

test('prerequisites and related topics name existing entries', () => {
	for (const e of entries) {
		for (const s of [...e.prerequisites, ...e.related]) {
			expect(bySlug.has(s), `${e.slug} → ${s}`).toBe(true);
		}
	}
});

test('prerequisites have no cycles and never sit above the topic level', () => {
	for (const e of entries) {
		for (const p of e.prerequisites) {
			expect(bySlug.get(p)!.level, `${e.slug} needs ${p}`).toBeLessThanOrEqual(e.level);
		}
	}
	const state = new Map<string, 'visiting' | 'done'>();
	const visit = (slug: string, path: string[]) => {
		if (state.get(slug) === 'done') return;
		if (state.get(slug) === 'visiting') throw new Error(`cycle: ${[...path, slug].join(' → ')}`);
		state.set(slug, 'visiting');
		for (const p of bySlug.get(slug)!.prerequisites) visit(p, [...path, slug]);
		state.set(slug, 'done');
	};
	for (const e of entries) visit(e.slug, []);
});

test('related links are mutual and never repeat a prerequisite link', () => {
	for (const e of entries) {
		for (const r of e.related) {
			const other = bySlug.get(r)!;
			expect(other.related, `${r} should list ${e.slug} as related`).toContain(e.slug);
			expect(e.prerequisites, `${e.slug}: ${r} is both related and a prerequisite`).not.toContain(
				r
			);
			expect(
				other.prerequisites,
				`${r}: ${e.slug} is both related and a prerequisite`
			).not.toContain(e.slug);
		}
	}
});

test('category counts match the entries', () => {
	expect(categories.length).toBeGreaterThan(0);
	for (const c of categories) expect(c.slugs.length, c.name).toBe(c.declared);
	expect(categories.reduce((n, c) => n + c.slugs.length, 0)).toBe(entries.length);
});

test('every built explainer has a catalogue entry and its route', () => {
	const routes = fs
		.readdirSync('src/routes', { withFileTypes: true })
		.filter((d) => d.isDirectory() && fs.existsSync(`src/routes/${d.name}/steps.ts`))
		.map((d) => d.name);
	expect(routes.length).toBeGreaterThan(0);
	const registry = fs.readFileSync('src/lib/topics.ts', 'utf8');
	for (const slug of routes) {
		expect(bySlug.has(slug), `route ${slug} is not a catalogue slug`).toBe(true);
		expect(registry, `${slug} is not registered in src/lib/topics.ts`).toContain(`slug: '${slug}'`);
	}
});
