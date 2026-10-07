/**
 * Parser for the topic catalogue (`docs/TOPICS.md`). Pure, so that it can run
 * both in the site build (through `catalog.ts`) and in Node for the catalogue
 * invariants test.
 */

export type Level = 1 | 2 | 3;
export type Kind = 'manipulate' | 'simulate' | 'step' | 'build' | 'explore';

export interface CatalogCategory {
	/** Short id from the category table, e.g. `medicine`. */
	id: string;
	/** Display name, e.g. `Body & Medicine`. */
	name: string;
	/** Topic count declared in the category table. */
	declared: number;
	/** Slugs of the category's topics, in catalogue order. */
	slugs: string[];
}

export interface CatalogEntry {
	slug: string;
	title: string;
	level: Level;
	kind: Kind;
	interaction: string;
	takeaway: string;
	prerequisites: string[];
	related: string[];
	needs?: string;
	pitfall?: string;
	/** Id of the category the entry is filed under. */
	category: string;
}

export interface Catalog {
	categories: CatalogCategory[];
	entries: CatalogEntry[];
	bySlug: Map<string, CatalogEntry>;
	/** Checklist slugs in order, with their ticked state. */
	checklist: { slug: string; done: boolean; category: string }[];
}

export const levelNames: Record<Level, string> = {
	1: 'High school',
	2: 'Final year of high school or first year of university',
	3: 'University student in the field'
};

const slugList = (value: string | undefined) =>
	!value || value.trim() === 'none'
		? []
		: value
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean);

/** Parses the catalogue markdown. Exported for the invariants test. */
export function parseCatalog(markdown: string): Catalog {
	const lines = markdown.split('\n');
	const section = (title: string) => {
		const start = lines.findIndex((l) => l.trim() === `## ${title}`);
		if (start < 0) throw new Error(`TOPICS.md: missing section "## ${title}"`);
		let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
		if (end < 0) end = lines.length;
		return lines.slice(start + 1, end);
	};

	// Category table: | Name | `id` | count |
	const categories: CatalogCategory[] = [];
	for (const line of section('Categories')) {
		const m = line.match(/^\|\s*(.+?)\s*\|\s*`([a-z-]+)`\s*\|\s*(\d+)\s*\|$/);
		if (m) categories.push({ name: m[1], id: m[2], declared: Number(m[3]), slugs: [] });
	}
	const categoryByName = new Map(categories.map((c) => [c.name, c]));

	// Checklist: **Category name** followed by - [ ] slug lines.
	const checklist: Catalog['checklist'] = [];
	let checklistCategory = '';
	for (const line of section('Checklist')) {
		const heading = line.match(/^\*\*(.+)\*\*$/);
		if (heading) checklistCategory = categoryByName.get(heading[1])?.id ?? heading[1];
		const item = line.match(/^- \[( |x)\] ([a-z0-9-]+)$/);
		if (item) checklist.push({ slug: item[2], done: item[1] === 'x', category: checklistCategory });
	}

	// Entries: ### Category, #### slug, - **Field:** value
	const entries: CatalogEntry[] = [];
	let category: CatalogCategory | undefined;
	let fields: Record<string, string> | null = null;
	let slug = '';
	const flush = () => {
		if (!fields || !category) return;
		const level = Number(fields.Level);
		if (level !== 1 && level !== 2 && level !== 3) {
			throw new Error(`TOPICS.md: ${slug} has an invalid level "${fields.Level}"`);
		}
		entries.push({
			slug,
			title: fields.Title,
			level,
			kind: fields.Kind as Kind,
			interaction: fields.Interaction,
			takeaway: fields.Takeaway,
			prerequisites: slugList(fields.Prerequisites),
			related: slugList(fields.Related),
			needs: fields.Needs,
			pitfall: fields.Pitfall,
			category: category.id
		});
		category.slugs.push(slug);
		fields = null;
	};
	for (const line of section('Topics')) {
		const cat = line.match(/^### (.+)$/);
		const entry = line.match(/^#### ([a-z0-9-]+)$/);
		const field = line.match(/^- \*\*(.+?):\*\* (.*)$/);
		if (cat) {
			flush();
			category = categoryByName.get(cat[1].trim());
			if (!category) throw new Error(`TOPICS.md: unknown category "${cat[1]}"`);
		} else if (entry) {
			flush();
			slug = entry[1];
			fields = {};
		} else if (field && fields) {
			fields[field[1]] = field[2].trim();
		}
	}
	flush();

	return { categories, entries, bySlug: new Map(entries.map((e) => [e.slug, e])), checklist };
}
