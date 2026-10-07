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
	},
	{
		slug: 'epidemics',
		title: 'How epidemics spread\u00a0— and how they stop',
		summary:
			'Release a few cases into a crowd and watch an outbreak grow, peak and fade. Then find out how many people need to be immune to stop it before it starts.',
		accent: '#d0454c',
		steps: 12,
		minutes: 15
	},
	{
		slug: 'unit-circle',
		title: 'Sine, cosine and the unit circle',
		summary:
			'Drag a point around a circle and watch its height and its sideways position trace out the sine and cosine waves.',
		accent: '#7048e8',
		steps: 9,
		minutes: 12
	},
	{
		slug: 'sorting',
		title: 'How computers sort',
		summary:
			'Watch four sorting methods put the same bars in order, count every comparison they make, and see why the way the cost grows matters more than the speed of the computer.',
		accent: '#0b7285',
		steps: 10,
		minutes: 15
	},
	{
		slug: 'newtons-laws',
		title: "Newton's laws: forces, motion and energy",
		summary:
			'Push carts, launch projectiles and send a car along a track you shape yourself, and see why forces change motion instead of keeping it going — and why momentum and energy never get lost.',
		accent: '#1971c2',
		steps: 10,
		minutes: 15
	},
	{
		slug: 'sun-earth-moon',
		title: 'Seasons, Moon phases, eclipses and tides',
		summary:
			'Tilt the Earth, move it round the Sun and swing the Moon around it: four everyday sky puzzles turn out to be the geometry of three bodies.',
		accent: '#e67700',
		steps: 10,
		minutes: 15
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
