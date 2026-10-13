/**
 * Phone readouts: the readouts and captions a scene declares with `<Readout>`.
 *
 * At 390 px the 960-unit stage is drawn at ~0.4 scale, so its 13-unit labels
 * come out ~5 px tall. On narrow screens (viewport ≤ 640 px) a `<Readout>`'s
 * SVG content is left out and its text is listed in an HTML panel under the
 * stage instead (`ReadoutPanel.svelte`); wider screens draw the SVG as before.
 * The explainer owns one registry; scenes reach it through context, since the
 * stage snippet renders inside `<Explainer>`.
 *
 * The breakpoint is the viewport width, not the stage's: on a phone the stage
 * spans the screen, and a media query keeps it simple. The pages are
 * prerendered at desktop width (`MediaQuery` falls back to `false`), so a phone
 * switches to the panel on hydration.
 */
import { getContext, setContext } from 'svelte';
import { MediaQuery, SvelteMap } from 'svelte/reactivity';

export interface ReadoutEntry {
	id: string;
	/** Position in the panel (ascending), then registration order. */
	order: number;
	/** Name of the quantity or part ("Lumen", "Photosystem II"). */
	label: string;
	/** The number or short statement ("pH ≈ 6.2"). Without it the entry is a key chip. */
	value?: string;
	/** A secondary line in smaller, muted text. */
	note?: string;
	/** Colour of the dot before the label (a CSS colour or variable). */
	color?: string;
	/** Number of the badge drawn in the SVG at the part this entry names. */
	marker?: number;
	/** 0–1: follows the scene's own fade, so dimmed parts are dimmed here too. */
	opacity: number;
	/** The `<Readout>` instance that registered it. */
	owner: object;
}

export class Readouts {
	readonly entries = new SvelteMap<string, ReadoutEntry>();
	#narrow = new MediaQuery('max-width: 640px', false);

	/** Narrow screen: readouts render in the HTML panel instead of the SVG. */
	get out() {
		return this.#narrow.current;
	}
	/** Rows with a value, in panel order; one faded out in the scene (another step's) is left out. */
	get rows() {
		return this.#sorted().filter((e) => e.value !== undefined && e.opacity >= 0.05);
	}
	/** Key chips (entries without a value): the numbered parts of the drawing. */
	get keys() {
		return this.#sorted().filter((e) => e.value === undefined);
	}
	get size() {
		return this.entries.size;
	}

	#sorted() {
		return [...this.entries.values()].sort((a, b) => a.order - b.order);
	}
}

const KEY = Symbol('readouts');
export const provideReadouts = (r: Readouts) => setContext(KEY, r);
export const useReadouts = () => getContext<Readouts | undefined>(KEY);
