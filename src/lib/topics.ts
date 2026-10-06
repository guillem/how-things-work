/**
 * Registry of explainers shown on the index page.
 *
 * To add a new explainer:
 *   1. create `src/routes/<slug>/+page.svelte` (see `photosynthesis` for a template)
 *   2. add an entry here with `status: 'published'`
 *   3. optionally add a small illustration in `TopicArt.svelte`
 */
export type Category = 'Biology' | 'Chemistry' | 'Physics' | 'Technology' | 'Earth & space';

export interface Topic {
	slug: string;
	title: string;
	summary: string;
	category: Category;
	/** Accent colour used for the card and the explainer's controls. */
	accent: string;
	/** Number of steps in the explainer (shown on the card). */
	steps: number;
	/** Rough reading time in minutes. */
	minutes: number;
	status: 'published' | 'planned';
}

export const topics: Topic[] = [
	{
		slug: 'photosynthesis',
		title: 'How photosynthesis works',
		summary:
			'Follow a photon from sunlight into a leaf and watch it split water, power an electron transport chain and build sugar out of thin air.',
		category: 'Biology',
		accent: '#2f9e5d',
		steps: 16,
		minutes: 20,
		status: 'published'
	},
	{
		slug: 'transistor',
		title: 'How a transistor works',
		summary: 'Doped silicon, depletion zones and why a tiny voltage can switch a large current.',
		category: 'Technology',
		accent: '#d97706',
		steps: 0,
		minutes: 0,
		status: 'planned'
	},
	{
		slug: 'gps',
		title: 'How GPS finds your position',
		summary: 'Atomic clocks in orbit, the speed of light and a little relativity.',
		category: 'Technology',
		accent: '#2563eb',
		steps: 0,
		minutes: 0,
		status: 'planned'
	},
	{
		slug: 'rainbows',
		title: 'How a rainbow forms',
		summary: 'Refraction, dispersion and the 42° circle you can never reach.',
		category: 'Physics',
		accent: '#7c3aed',
		steps: 0,
		minutes: 0,
		status: 'planned'
	}
];

export const published = topics.filter((t) => t.status === 'published');
export const planned = topics.filter((t) => t.status === 'planned');
