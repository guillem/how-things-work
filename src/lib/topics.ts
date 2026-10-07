/**
 * Registry of the explainers that are built.
 *
 * Which topics exist, and their category, level, prerequisites and related
 * topics, come from the catalogue (`docs/TOPICS.md`, parsed in `catalog.ts`).
 * This file only adds what the catalogue does not know: the explainer's own
 * title and summary, its accent colour and its length.
 *
 * To add a new explainer:
 *   1. create `src/routes/<slug>/` (see `photosynthesis` for a template); the
 *      slug must be the catalogue slug
 *   2. add an entry here
 *   3. optionally add a small illustration in `components/TopicArt.svelte`
 */
import { catalog, category, entry, type CatalogCategory, type CatalogEntry } from './catalog';

export interface Explainer {
	/** Catalogue slug; also the route. */
	slug: string;
	/** The explainer's own title (the catalogue title is `entry.title`). */
	title: string;
	summary: string;
	/** Accent colour used for the card and the explainer's controls. */
	accent: string;
	/** Number of steps in the explainer (shown on the card). */
	steps: number;
	/** Rough reading time in minutes. */
	minutes: number;
}

export interface Topic extends Explainer {
	entry: CatalogEntry;
	category: CatalogCategory;
}

const explainers: Explainer[] = [
	{
		slug: 'photosynthesis',
		title: 'How photosynthesis works',
		summary:
			'Follow a photon from sunlight into a leaf and watch it split water, power an electron transport chain and build sugar out of thin air.',
		accent: '#2f9e5d',
		steps: 16,
		minutes: 20
	}
];

export const topics: Topic[] = explainers.map((e) => {
	const meta = entry(e.slug);
	return { ...e, entry: meta, category: category(meta.category) };
});

export const topicBySlug = new Map(topics.map((t) => [t.slug, t]));

/** Catalogue categories that have at least one built topic, in catalogue order. */
export const sections = catalog.categories
	.map((c) => ({
		category: c,
		topics: c.slugs.flatMap((slug) => topicBySlug.get(slug) ?? [])
	}))
	.filter((s) => s.topics.length > 0);
