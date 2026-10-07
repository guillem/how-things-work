/**
 * The topic catalogue, parsed from `docs/TOPICS.md` at build time.
 *
 * `docs/TOPICS.md` is the source of truth for which topics exist, their
 * categories, levels, prerequisites and related topics. This module derives
 * that metadata from the file so the two cannot drift apart; nothing here is
 * typed by hand. Which topics are actually built lives in `topics.ts`.
 */
import source from '../../docs/TOPICS.md?raw';
import { parseCatalog, type CatalogCategory, type CatalogEntry } from './catalog-parse';

export * from './catalog-parse';

export const catalog = parseCatalog(source);

export function entry(slug: string): CatalogEntry {
	const e = catalog.bySlug.get(slug);
	if (!e) throw new Error(`No topic "${slug}" in docs/TOPICS.md`);
	return e;
}

export function category(id: string): CatalogCategory {
	const c = catalog.categories.find((c) => c.id === id);
	if (!c) throw new Error(`No category "${id}" in docs/TOPICS.md`);
	return c;
}

/** Slugs of the topics that list `slug` as a prerequisite (the "leads on to" list). */
export const dependents = (slug: string) =>
	catalog.entries.filter((e) => e.prerequisites.includes(slug)).map((e) => e.slug);
